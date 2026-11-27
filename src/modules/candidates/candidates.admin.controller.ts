import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/types/api-response';
import { User, UserRole } from '../users/entities/user.entity';
import { CandidateLoginService, type CandidateCoursesDto, type CandidateLoginDto } from './candidate-login.service';
import { CertificateDocumentsService } from './certificate-documents/certificate-documents.service';
import {
  CERTIFICATE_DOCUMENTS,
  CERTIFICATE_VARIANTS,
  type CertificateDocument,
  type CertificateVariant,
  documentFilename,
  enumOf,
} from './certificate-documents/certificate-format';
import type { CandidateDto } from './candidates.mapper';
import { CandidatesService } from './candidates.service';
import { CandidateQueryDto, CreateCandidateDto, UpdateCandidateDto } from './dto/candidate.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { SetLoginPasswordDto } from './dto/login-password.dto';

@ApiTags('admin: candidates')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/candidates')
export class CandidatesAdminController {
  constructor(
    private readonly candidates: CandidatesService,
    private readonly logins: CandidateLoginService,
    private readonly documents: CertificateDocumentsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List candidates',
    description: 'Newest first. `q` searches IDs, names, passport numbers and email. Counts arrive in `meta.pagination`.',
  })
  findAll(@Query() query: CandidateQueryDto): Promise<Paginated<CandidateDto>> {
    return this.candidates.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a candidate',
    description: 'certificateId is generated. Unknown course → 400. dateOfBirth must be in the past.',
  })
  @ApiConflictResponse({ description: 'CERTIFICATE_NO_TAKEN — the certificate number is already recorded.' })
  create(@Body() dto: CreateCandidateDto): Promise<CandidateDto> {
    return this.candidates.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a candidate' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateDto> {
    return this.candidates.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a candidate', description: 'certificateId never changes.' })
  @ApiConflictResponse({ description: 'CERTIFICATE_NO_TAKEN' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCandidateDto): Promise<CandidateDto> {
    return this.candidates.update(id, dto);
  }

  @Get(':id/documents/:document/:variant')
  @ApiOperation({
    summary: "Generate the candidate's certificate or transcript as a PDF",
    description:
      'Built from the record each time, so an edit shows up in the next download. TEFL and TESOL courses. Needs certificateNo and issueDate → 400 otherwise.',
  })
  @ApiParam({ name: 'document', enum: CERTIFICATE_DOCUMENTS })
  @ApiParam({
    name: 'variant',
    enum: CERTIFICATE_VARIANTS,
    description: 'digital: cream background, for screens and email. print: white background, for paper.',
  })
  @ApiProduces('application/pdf')
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('document', new ParseEnumPipe(enumOf(CERTIFICATE_DOCUMENTS))) document: CertificateDocument,
    @Param('variant', new ParseEnumPipe(enumOf(CERTIFICATE_VARIANTS))) variant: CertificateVariant,
  ): Promise<StreamableFile> {
    const candidate = await this.candidates.findOne(id);
    const pdf = await this.documents.render(document, variant, {
      passportName: candidate.passportName,
      certificateNo: candidate.certificateNo,
      dateOfBirth: candidate.dateOfBirth,
      issueDate: candidate.issueDate,
      courseTitle: candidate.course.title,
    });
    // certificateNo is set: render() refuses without it.
    const filename = documentFilename(candidate.certificateNo ?? '', document, variant);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: pdf.length,
    });
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a candidate', description: 'Sets isVerified and verifiedAt. Verifying again changes nothing.' })
  verify(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateDto> {
    return this.candidates.verify(id);
  }

  @Get(':id/login')
  @ApiOperation({
    summary: "A candidate's student login",
    description:
      'Username and, while it is still the starting password, the password. Admins only. Not part of the candidate list or detail, so the password is never returned in bulk.',
  })
  login(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateLoginDto> {
    return this.logins.get(id);
  }

  @Post(':id/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a student login for the candidate',
    description:
      'Uses the email on the record and a generated password, which can then be read back (until the student changes it). Links the existing account if that email already has one. Nothing is emailed unless `sendEmail` is true.',
  })
  createLogin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLoginDto,
    @CurrentUser() admin: User,
  ): Promise<CandidateLoginDto> {
    return this.logins.createLogin(id, admin.id, dto.sendEmail);
  }

  @Put(':id/login/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set the candidate\'s login password',
    description: 'Omit `password` to generate one. The student is signed out everywhere, and the new password can be read back until they change it.',
  })
  setLoginPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLoginPasswordDto,
    @CurrentUser() admin: User,
  ): Promise<CandidateLoginDto> {
    return this.logins.setPassword(id, admin.id, dto.password);
  }

  @Get(':id/courses')
  @ApiOperation({
    summary: "A candidate's courses and access",
    description: "The course they requested, the courses on their orders, and any course their login can already open, each with whether access is granted.",
  })
  courses(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateCoursesDto> {
    return this.logins.listCourses(id);
  }

  @Post(':id/courses/:courseId/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Grant the candidate's student login access to a course",
    description: 'Unlocks every module of that course for the student and emails them. Needs a login (created when they request a course on the website).',
  })
  grantCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() admin: User,
  ): Promise<CandidateCoursesDto> {
    return this.logins.grantCourse(id, courseId, admin.id);
  }

  @Delete(':id/courses/:courseId/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Take the candidate's access to a course away", description: 'The modules lock again for that student. Safe to repeat.' })
  revokeCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() admin: User,
  ): Promise<CandidateCoursesDto> {
    return this.logins.revokeCourse(id, courseId, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a candidate' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.candidates.remove(id);
  }
}
