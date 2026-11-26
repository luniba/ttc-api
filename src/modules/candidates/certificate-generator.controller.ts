import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CandidatesService } from './candidates.service';
import { CertificateDocumentsService } from './certificate-documents/certificate-documents.service';
import {
  CERTIFICATE_DOCUMENTS,
  CERTIFICATE_VARIANTS,
  type CertificateDocument,
  type CertificateVariant,
  documentFilename,
  enumOf,
} from './certificate-documents/certificate-format';
import { GenerateCertificateDto } from './dto/generate-certificate.dto';

// The "Generate certificates" page: a certificate from typed-in details, with no candidate record.
// Such a certificate isn't on the public verification check unless a candidate is also added.
@ApiTags('admin: certificates')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/certificates')
export class CertificateGeneratorController {
  constructor(
    private readonly candidates: CandidatesService,
    private readonly documents: CertificateDocumentsService,
  ) {}

  @Post(':document/:variant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a certificate or transcript from the given details',
    description: 'Nothing is saved. TEFL courses only for now → 400 otherwise.',
  })
  @ApiParam({ name: 'document', enum: CERTIFICATE_DOCUMENTS })
  @ApiParam({ name: 'variant', enum: CERTIFICATE_VARIANTS })
  @ApiProduces('application/pdf')
  async generate(
    @Param('document', new ParseEnumPipe(enumOf(CERTIFICATE_DOCUMENTS)))
    document: CertificateDocument,
    @Param('variant', new ParseEnumPipe(enumOf(CERTIFICATE_VARIANTS)))
    variant: CertificateVariant,
    @Body() dto: GenerateCertificateDto,
  ): Promise<StreamableFile> {
    const pdf = await this.documents.render(document, variant, {
      passportName: dto.passportName,
      certificateNo: dto.certificateNo,
      dateOfBirth: dto.dateOfBirth,
      issueDate: dto.issueDate,
      courseTitle: await this.candidates.courseTitle(dto.courseId),
    });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${documentFilename(dto.certificateNo, document, variant)}"`,
      length: pdf.length,
    });
  }
}
