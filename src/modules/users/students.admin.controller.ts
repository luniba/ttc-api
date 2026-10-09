import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/types/api-response';
import { StudentQueryDto } from './dto/student.dto';
import { STAFF_ROLES } from './entities/user.entity';
import { UsersService, type StudentDto } from './users.service';

// Read-only for now, and gated to all staff — an instructor may browse students even though the sibling UsersAdminController re-gates
// its writes to admin. Students (role=student) never appear in that list; they appear only here.
@ApiTags('admin: students')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not staff.' })
@Roles(...STAFF_ROLES)
@Controller('admin/students')
export class StudentsAdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List students',
    description:
      'Student accounts only — staff are never listed here. `q` searches name and email. Newest first.',
  })
  @ApiOkResponse({ description: 'Students, newest first.' })
  findAll(@Query() query: StudentQueryDto): Promise<Paginated<StudentDto>> {
    return this.users.listStudents(query);
  }
}
