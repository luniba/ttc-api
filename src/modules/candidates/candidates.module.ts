import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';
import { CandidatesAdminController } from './candidates.admin.controller';
import { CandidatesService } from './candidates.service';
import { CertificatesController } from './certificates.controller';
import { Candidate } from './entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, Course])],
  controllers: [CandidatesAdminController, CertificatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
