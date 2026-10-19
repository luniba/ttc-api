import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  // Anonymous, writes a row and sends email: a tight per-IP cap.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Request to purchase a course',
    description:
      'Records the person as an unverified candidate for the course and emails the admin. No payment is taken; the team follows up.',
  })
  async request(@Body() dto: CheckoutDto): Promise<{ message: string }> {
    await this.checkout.request(dto);
    return { message: 'Request received' };
  }
}
