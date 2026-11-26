import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';
import { MailModule } from '../../mail/mail.module';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { UsersModule } from '../users/users.module';
import { CandidateLoginService } from './candidate-login.service';
import { CandidatesAdminController } from './candidates.admin.controller';
import { CandidatesService } from './candidates.service';
import { CertificateDocumentsService } from './certificate-documents/certificate-documents.service';
import { CertificateGeneratorController } from './certificate-generator.controller';
import { CertificatesController } from './certificates.controller';
import { Candidate } from './entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, Course, OrderItem]), UsersModule, EnrolmentsModule, MailModule],
  controllers: [CandidatesAdminController, CertificatesController, CertificateGeneratorController],
  providers: [CandidatesService, CandidateLoginService, CertificateDocumentsService],
  exports: [CandidateLoginService],
})
export class CandidatesModule {}
