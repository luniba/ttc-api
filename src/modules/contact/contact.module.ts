import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../mail/mail.module';
import { Course } from '../courses/entities/course.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [MailModule, TypeOrmModule.forFeature([Course])],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
