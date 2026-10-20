import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';
import { MailModule } from '../../mail/mail.module';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { UsersModule } from '../users/users.module';
import { CandidateLoginService } from './candidate-login.service';
import { CandidatesAdminController } from './candidates.admin.controller';
import { CandidatesService } from './candidates.service';
import { CertificatesController } from './certificates.controller';
import { Candidate } from './entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, Course]), UsersModule, EnrolmentsModule, MailModule],
  controllers: [CandidatesAdminController, CertificatesController],
  providers: [CandidatesService, CandidateLoginService],
})
export class CandidatesModule {}
