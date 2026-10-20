import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrolmentsService } from './enrolments.service';
import { Enrolment } from './entities/enrolment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Enrolment])],
  providers: [EnrolmentsService],
  exports: [EnrolmentsService],
})
export class EnrolmentsModule {}
