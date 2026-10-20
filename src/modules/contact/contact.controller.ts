import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  // Public: tight per-IP cap.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Send a message from the public contact form', description: 'Emails the message to the site admin; the visitor is set as Reply-To.' })
  async send(@Body() dto: ContactDto): Promise<{ message: string }> {
    await this.contact.send(dto);
    return { message: 'Message sent' };
  }
}
