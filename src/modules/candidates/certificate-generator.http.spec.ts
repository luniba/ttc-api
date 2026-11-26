import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { CandidatesService } from './candidates.service';
import { CertificateDocumentsService } from './certificate-documents/certificate-documents.service';
import { CertificateGeneratorController } from './certificate-generator.controller';

// POST /admin/certificates/:document/:variant through the real pipes, envelope and generator;
// only the course lookup is stubbed.
describe('POST /admin/certificates/:document/:variant', () => {
  const courseId = '0b6f7a52-8f0e-4f7c-9d0c-2f6a1b9e4c11';
  const titles: Record<string, string> = {
    [courseId]: 'Advanced 120-Hour TEFL Course',
  };
  const body = {
    passportName: 'Hiyari Mohamed',
    courseId,
    certificateNo: 'TTC-1132-8345',
    dateOfBirth: '1998-10-25',
    issueDate: '2026-11-23',
  };
  let app: INestApplication;
  let base: string;

  const post = (path: string, payload: object) =>
    fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CertificateGeneratorController],
      providers: [
        CertificateDocumentsService,
        {
          provide: CandidatesService,
          useValue: {
            courseTitle: (id: string) =>
              Promise.resolve(titles[id] ?? 'Football'),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0);
    base = `${await app.getUrl()}/admin/certificates`;
  });

  afterAll(() => app.close());

  it('returns the generated PDF', async () => {
    const res = await post('transcript/print', body);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="TTC-1132-8345-transcript-print.pdf"',
    );
    expect(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
  });

  it('rejects missing or invalid fields', async () => {
    expect(
      (await post('certificate/digital', { ...body, passportName: '   ' }))
        .status,
    ).toBe(400);
    expect(
      (await post('certificate/digital', { ...body, issueDate: '2026-02-30' }))
        .status,
    ).toBe(400);
    expect(
      (await post('certificate/digital', { ...body, extra: 1 })).status,
    ).toBe(400);
  });

  it('refuses a non-TEFL course', async () => {
    const other = '9a1d1f2e-0000-4000-8000-000000000000';
    expect(
      (await post('certificate/print', { ...body, courseId: other })).status,
    ).toBe(400);
  });
});
