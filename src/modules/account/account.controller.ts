import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import type { SafeUser } from '../users/user.mapper';
import { AccountService, type AccountDto } from './account.service';
import { UpdateUsernameDto } from './dto/update-username.dto';

// The caller's own data only.
@ApiTags('account')
@ApiBearerAuth('access-token')
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('account')
  @ApiOperation({
    summary: 'My profile, courses and certificates',
    description: 'Courses are the ones an admin granted access to, plus ones they requested that are still waiting.',
  })
  get(@CurrentUser() user: User): Promise<AccountDto> {
    return this.account.get(user);
  }

  @Patch('username')
  @ApiOperation({ summary: 'Change my username', description: 'Name and password have their own endpoints; the email cannot be changed.' })
  @ApiConflictResponse({ description: 'USERNAME_TAKEN' })
  setUsername(@CurrentUser() user: User, @Body() dto: UpdateUsernameDto): Promise<SafeUser> {
    return this.account.setUsername(user.id, dto.username);
  }
}
