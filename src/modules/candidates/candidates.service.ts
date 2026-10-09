import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, type SelectQueryBuilder } from 'typeorm';
import { ErrorCode } from '../../common/constants/error-codes';
import { Paginated } from '../../common/types/api-response';
import { escapeLike } from '../../common/utils/escape-like';
import { Course } from '../courses/entities/course.entity';
import { toCandidateDto, type CandidateDto } from './candidates.mapper';
import { generateCertificateId } from './certificate-id';
import type { CandidateQueryDto, CreateCandidateDto, UpdateCandidateDto } from './dto/candidate.dto';
import type { VerifyCertificateDto } from './dto/verify-certificate.dto';
import { Candidate } from './entities/candidate.entity';

// Which unique index a failed insert/update hit, if any.
const violatedIndex = (error: unknown): string | undefined =>
  error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505'
    ? (error.driverError as { constraint?: string }).constraint
    : undefined;

const certificateNoTaken = (no: string) =>
  new ConflictException({
    message: `Certificate number "${no}" is already recorded`,
    error: 'Conflict',
    code: ErrorCode.CERTIFICATE_NO_TAKEN,
  });

const today = () => new Date().toISOString().slice(0, 10);

// Only what the printed certificate already shows; never the passport number, email or address.
export interface VerifiedCertificateDto {
  certificateId: string;
  holderName: string;
  courseTitle: string;
  issuedAt: string;
}

const squish = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(Candidate) private readonly repo: Repository<Candidate>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  // withDeleted on the join only: a course deleted later still shows its title on its holders.
  private query(): SelectQueryBuilder<Candidate> {
    return this.repo
      .createQueryBuilder('candidate')
      .innerJoinAndSelect('candidate.course', 'course')
      .withDeleted()
      .andWhere('candidate.deletedAt IS NULL');
  }

  async findAll(query: CandidateQueryDto): Promise<Paginated<CandidateDto>> {
    const qb = this.query();

    if (query.verified !== undefined) {
      qb.andWhere('candidate.isVerified = :verified', { verified: query.verified });
    }

    const term = query.q?.trim();
    if (term) {
      qb.andWhere(
        `(candidate.certificateId ILIKE :term OR candidate.certificateNo ILIKE :term
          OR candidate.passportName ILIKE :term OR candidate.passportNo ILIKE :term
          OR candidate.email ILIKE :term)`,
        { term: `%${escapeLike(term)}%` },
      );
    }

    // Verified lists read newest verification first; id tie-break so equal timestamps can't swap between pages.
    qb.orderBy(query.verified ? 'candidate.verifiedAt' : 'candidate.createdAt', 'DESC').addOrderBy(
      'candidate.id',
      'ASC',
    );

    const [rows, total] = await qb.take(query.limit).skip(query.skip).getManyAndCount();
    return new Paginated(rows.map(toCandidateDto), total, query.page, query.limit);
  }

  async findOne(id: string): Promise<CandidateDto> {
    const candidate = await this.query().andWhere('candidate.id = :id', { id }).getOne();
    if (!candidate) throw new NotFoundException('Candidate not found');
    return toCandidateDto(candidate);
  }

  async create(dto: CreateCandidateDto): Promise<CandidateDto> {
    await this.assertCourseExists(dto.courseId);
    this.assertBornBeforeToday(dto.dateOfBirth);

    // A generated ID clashing is about one in a trillion; retry a few times rather than fail.
    for (let attempt = 0; ; attempt++) {
      try {
        const saved = await this.repo.save(
          this.repo.create({ ...dto, certificateId: generateCertificateId() }),
        );
        return this.findOne(saved.id);
      } catch (error) {
        const index = violatedIndex(error);
        if (index === 'uq_candidates_certificate_id' && attempt < 4) continue;
        if (index === 'uq_candidates_certificate_no') throw certificateNoTaken(dto.certificateNo);
        throw error;
      }
    }
  }

  async update(id: string, dto: UpdateCandidateDto): Promise<CandidateDto> {
    const candidate = await this.repo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('Candidate not found');

    if (dto.courseId !== undefined && dto.courseId !== candidate.courseId) {
      await this.assertCourseExists(dto.courseId);
    }
    if (dto.dateOfBirth !== undefined) this.assertBornBeforeToday(dto.dateOfBirth);

    Object.assign(candidate, dto);
    try {
      await this.repo.save(candidate);
    } catch (error) {
      if (violatedIndex(error) === 'uq_candidates_certificate_no') {
        throw certificateNoTaken(candidate.certificateNo);
      }
      throw error;
    }
    return this.findOne(id);
  }

  // Idempotent: verifying twice keeps the first verification time.
  async verify(id: string): Promise<CandidateDto> {
    const candidate = await this.repo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.isVerified) {
      await this.repo.update(id, { isVerified: true, verifiedAt: new Date() });
    }
    return this.findOne(id);
  }

  // Public check: all three details must match a verified candidate. One generic 404 otherwise,
  // so a caller can't learn which detail was wrong or that an unverified record exists.
  async verifyCertificate(dto: VerifyCertificateDto): Promise<VerifiedCertificateDto> {
    const candidate = await this.query()
      .andWhere('candidate.isVerified = true')
      .andWhere('LOWER(candidate.certificateId) = :certificateId', {
        certificateId: dto.certificateId.toLowerCase(),
      })
      .andWhere(`LOWER(REGEXP_REPLACE(candidate.passportNo, '\\s+', '', 'g')) = :passportNo`, {
        passportNo: dto.passportNumber.replace(/\s+/g, '').toLowerCase(),
      })
      .andWhere(`LOWER(REGEXP_REPLACE(TRIM(candidate.passportName), '\\s+', ' ', 'g')) = :name`, {
        name: squish(dto.fullName),
      })
      .getOne();
    if (!candidate) throw new NotFoundException('No matching certificate');
    return {
      certificateId: candidate.certificateId,
      holderName: candidate.passportName,
      courseTitle: candidate.course.title,
      issuedAt: candidate.issueDate,
    };
  }

  // Soft delete: the record (and its certificate ID) can be restored.
  async remove(id: string): Promise<{ message: string }> {
    if (!(await this.repo.existsBy({ id }))) throw new NotFoundException('Candidate not found');
    await this.repo.softDelete(id);
    return { message: 'Candidate deleted' };
  }

  // Only live courses can be assigned; existing holders keep a course deleted later.
  private async assertCourseExists(courseId: string): Promise<void> {
    if (!(await this.courses.existsBy({ id: courseId }))) {
      throw new BadRequestException(`No course with id "${courseId}"`);
    }
  }

  private assertBornBeforeToday(dateOfBirth: string): void {
    if (dateOfBirth >= today()) {
      throw new BadRequestException('dateOfBirth must be in the past');
    }
  }
}
