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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/types/api-response';
import { UserRole } from '../users/entities/user.entity';
import type { CandidateDto } from './candidates.mapper';
import { CandidatesService } from './candidates.service';
import { CandidateQueryDto, CreateCandidateDto, UpdateCandidateDto } from './dto/candidate.dto';

@ApiTags('admin: candidates')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/candidates')
export class CandidatesAdminController {
  constructor(private readonly candidates: CandidatesService) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a candidate' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.candidates.remove(id);
  }
}
