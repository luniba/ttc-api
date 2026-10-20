import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from '../candidates/entities/candidate.entity';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { UsersModule } from '../users/users.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate]), UsersModule, EnrolmentsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
