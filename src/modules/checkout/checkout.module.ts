import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../mail/mail.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Course } from '../courses/entities/course.entity';
import { UsersModule } from '../users/users.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [MailModule, UsersModule, TypeOrmModule.forFeature([Candidate, Course])],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
