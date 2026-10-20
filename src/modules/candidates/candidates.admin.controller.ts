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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/types/api-response';
import { User, UserRole } from '../users/entities/user.entity';
import { CandidateLoginService, type CandidateLoginDto } from './candidate-login.service';
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

  @Post(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Grant the candidate's student login access to their course",
    description: 'Unlocks every module for that student and emails them. Needs a login (created when they request a course on the website).',
  })
  grantAccess(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: User): Promise<CandidateLoginDto> {
    return this.logins.grantAccess(id, admin.id);
  }

  @Delete(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Take the candidate's course access away", description: 'The modules lock again for that student. Safe to repeat.' })
  revokeAccess(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: User): Promise<CandidateLoginDto> {
    return this.logins.revokeAccess(id, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a candidate' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.candidates.remove(id);
  }
}
