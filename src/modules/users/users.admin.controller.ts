import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateStaffDto,
  SetStaffPasswordDto,
  StaffQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { STAFF_ROLES, User, UserRole } from './entities/user.entity';
import { toSafeUser, type SafeUser } from './user.mapper';
import { UsersService } from './users.service';

// Gated to STAFF_ROLES so an instructor can see the team, but every write re-gates to @Roles(UserRole.ADMIN) — method-level @Roles
// overrides the class rather than intersecting with it, so each write states ADMIN explicitly.
@ApiTags('admin: users')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not staff.' })
@Roles(...STAFF_ROLES)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List admins and instructors',
    description:
      'Visible to all staff. Students are never listed here. `q` searches name and email.',
  })
  @ApiOkResponse({ description: 'Admins first, then newest instructor.' })
  async findStaff(@Query() query: StaffQueryDto): Promise<SafeUser[]> {
    const staff = await this.users.findStaff(query.q);
    return staff.map(toSafeUser);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create an instructor (admin only)',
    description:
      'Always creates an `instructor` — the role is not settable, so this endpoint can never mint an admin. The account is created email-verified, so the new instructor can sign in with the password given here immediately.',
  })
  @ApiCreatedResponse({ description: 'The created instructor.' })
  @ApiConflictResponse({ description: 'The email already belongs to someone.' })
  async createInstructor(@Body() dto: CreateStaffDto): Promise<SafeUser> {
    const user = await this.users.createInstructor(dto);
    return toSafeUser(user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: "Update an instructor's name/email (admin only)",
    description:
      'Instructors only — another admin cannot be edited here, because changing their email is one password-reset away from taking their account. Use your own account settings to change your own details.',
  })
  @ApiOkResponse({ description: 'The updated instructor.' })
  @ApiConflictResponse({ description: 'The email already belongs to someone.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @Req() request: Request & { user?: User },
  ): Promise<SafeUser> {
    const user = await this.users.updateStaff(id, request.user!.id, dto);
    return toSafeUser(user);
  }

  @Patch(':id/password')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set an instructor's password (admin only)",
    description:
      'Instructors only, and never yourself. No current-password check — the admin role is the authority. Every session the instructor holds is revoked, so the old password stops working everywhere.',
  })
  setPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStaffPasswordDto,
    @Req() request: Request & { user?: User },
  ): Promise<{ message: string }> {
    return this.users.setStaffPassword(id, request.user!.id, dto.password);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a staff member (admin only)',
    description: 'Refuses self-deletion. Students are not reachable here.',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user?: User },
  ): Promise<{ message: string }> {
    // The non-null assertion is safe: JwtAuthGuard has populated request.user, and this route is never Public.
    return this.users.removeStaff(id, request.user!.id);
  }
}
