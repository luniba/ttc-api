import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CandidatesService, type VerifiedCertificateDto } from './candidates.service';
import { VerifyCertificateDto } from './dto/verify-certificate.dto';

@ApiTags('certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Public()
  // Every guess needs all three details right; the cap stops anyone grinding through IDs.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a certificate',
    description:
      'Matches name (case and spacing ignored), passport number and certificate ID (case ignored) against verified candidates.',
  })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — no verified certificate matches all three. Does not say which field was wrong.' })
  verify(@Body() dto: VerifyCertificateDto): Promise<VerifiedCertificateDto> {
    return this.candidates.verifyCertificate(dto);
  }
}
