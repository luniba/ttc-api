import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { CandidateLoginService } from '../candidate-login.service';
import { CandidatesAdminController } from '../candidates.admin.controller';
import { CandidatesService } from '../candidates.service';
import { CertificateDocumentsService } from './certificate-documents.service';

// The download goes through the real controller, response envelope and PDF generator; only the
// database lookup is stubbed. Guards aren't registered here (they're global in AppModule).
describe('GET /admin/candidates/:id/documents/:document/:variant', () => {
  const id = '6f1c2f0e-3b7a-4c1e-9a52-1f2d3c4b5a69';
  const candidate = {
    id,
    passportName: 'Hiyari Mohamed',
    certificateNo: 'TTC-1132-8345' as string | null,
    dateOfBirth: '1998-10-25',
    issueDate: '2026-11-23' as string | null,
    course: { id: 'c', title: 'Advanced 120-Hour TEFL Course' },
  };
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CandidatesAdminController],
      providers: [
        CertificateDocumentsService,
        {
          provide: CandidatesService,
          useValue: { findOne: () => Promise.resolve({ ...candidate }) },
        },
        { provide: CandidateLoginService, useValue: {} },
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
    base = `${await app.getUrl()}/admin/candidates/${id}/documents`;
  });

  afterAll(() => app.close());

  it.each([
    ['certificate', 'digital'],
    ['certificate', 'print'],
    ['transcript', 'digital'],
    ['transcript', 'print'],
  ])(
    'returns the %s (%s) as a PDF download, not wrapped in JSON',
    async (document, variant) => {
      const res = await fetch(`${base}/${document}/${variant}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toBe(
        `attachment; filename="TTC-1132-8345-${document}-${variant}.pdf"`,
      );
      const bytes = Buffer.from(await res.arrayBuffer());
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    },
  );

  it('rejects an unknown document or variant', async () => {
    expect((await fetch(`${base}/diploma/print`)).status).toBe(400);
    expect((await fetch(`${base}/certificate/a3`)).status).toBe(400);
  });

  it('refuses a course that is neither TEFL nor TESOL', async () => {
    candidate.course.title = 'A-Level Advanced Football Course';
    try {
      expect((await fetch(`${base}/certificate/print`)).status).toBe(400);
    } finally {
      candidate.course.title = 'Advanced 120-Hour TEFL Course';
    }
  });

  it('generates a TESOL transcript', async () => {
    candidate.course.title = 'Advanced 120-Hour TESOL Course';
    try {
      const res = await fetch(`${base}/transcript/digital`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
    } finally {
      candidate.course.title = 'Advanced 120-Hour TEFL Course';
    }
  });

  it('refuses a record without a certificate number', async () => {
    candidate.certificateNo = null;
    try {
      expect((await fetch(`${base}/transcript/print`)).status).toBe(400);
    } finally {
      candidate.certificateNo = 'TTC-1132-8345';
    }
  });
});
