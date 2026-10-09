import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { StudentsAdminController } from './students.admin.controller';
import { UsersAdminController } from './users.admin.controller';
import { UsersService } from './users.service';

@Module({
  // RefreshToken registered here too (forFeature is per-module) since UsersService evicts an instructor's sessions on password reset.
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  controllers: [UsersAdminController, StudentsAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
