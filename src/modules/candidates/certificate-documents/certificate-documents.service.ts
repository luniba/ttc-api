import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type PDFFont,
  type PDFPage,
  PDFDocument,
  type RGB,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import {
  type CertificateDocument,
  type CertificateVariant,
  formatDateOfBirth,
  formatIssueDate,
  printedName,
  courseLabel,
} from './certificate-format';

// src/assets/certificates, copied to dist/assets/certificates by nest-cli.json. Same relative path from both.
const ASSETS_DIR = join(__dirname, '..', '..', '..', 'assets', 'certificates');

export interface CertificateData {
  passportName: string;
  certificateNo: string | null;
  dateOfBirth: string;
  issueDate: string | null;
  courseTitle: string;
}

type FontKey =
  'garamondItalic' | 'latoBold' | 'latoRegular' | 'helvetica' | 'helveticaBold';
type Fonts = Partial<Record<FontKey, PDFFont>>;

// One piece of text on a template. Coordinates are PDF points measured from the TOP-left of the
// page (as the template was measured), y is the text baseline. align 'center' centres on x.
interface TextSlot {
  font: FontKey;
  size: number;
  color: RGB;
  x: number;
  y: number;
  align: 'left' | 'center';
  // Text wider than this shrinks to fit, down to minSize; past that it's drawn at minSize.
  maxWidth: number;
  minSize?: number;
}

const hex = (value: number): RGB =>
  rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
const NAVY = hex(0x0e1f34);
const INK = hex(0x16202b);

// Measured from the original designer PDFs (see assets/certificates/README.md).
const CERTIFICATE_LAYOUT: Record<
  CertificateVariant,
  Record<'course' | 'name' | 'number' | 'issued', TextSlot>
> = {
  // 2560 × 1808 pt landscape
  digital: {
    course: {
      font: 'latoBold',
      size: 38.4,
      color: NAVY,
      x: 1280,
      y: 789.7,
      align: 'center',
      maxWidth: 1700,
    },
    name: {
      font: 'garamondItalic',
      size: 74,
      color: NAVY,
      x: 1280,
      y: 980,
      align: 'center',
      maxWidth: 1380,
      minSize: 44,
    },
    number: {
      font: 'helvetica',
      size: 29,
      color: INK,
      x: 112.8,
      y: 1694,
      align: 'left',
      maxWidth: 700,
    },
    issued: {
      font: 'helvetica',
      size: 29,
      color: INK,
      x: 112.8,
      y: 1728,
      align: 'left',
      maxWidth: 700,
    },
  },
  // 842 × 595 pt landscape (A4)
  print: {
    course: {
      font: 'helveticaBold',
      size: 12.6,
      color: hex(0x191f34),
      x: 421,
      y: 260.1,
      align: 'center',
      maxWidth: 560,
    },
    name: {
      font: 'garamondItalic',
      size: 22,
      color: hex(0x222837),
      x: 421,
      y: 307.6,
      align: 'center',
      maxWidth: 490,
      minSize: 13,
    },
    number: {
      font: 'helvetica',
      size: 9.5,
      color: rgb(0, 0, 0),
      x: 37.1,
      y: 557.5,
      align: 'left',
      maxWidth: 240,
    },
    issued: {
      font: 'helvetica',
      size: 9.5,
      color: rgb(0, 0, 0),
      x: 37.1,
      y: 570.2,
      align: 'left',
      maxWidth: 240,
    },
  },
};

// 1808 × 2560 pt portrait; both variants share positions.
const TRANSCRIPT_LAYOUT: Record<
  'name' | 'dob' | 'course' | 'number' | 'issued' | 'programme',
  TextSlot
> = {
  // Closes "Certificate in Teaching English to Speakers of Other Languages (" in the heading,
  // which the template prints up to the bracket: "TEFL)" or "TESOL)".
  programme: {
    font: 'latoBold',
    size: 36.7,
    color: INK,
    x: 1269.9,
    y: 852,
    align: 'left',
    maxWidth: 200,
  },
  name: {
    font: 'helvetica',
    size: 34,
    color: INK,
    x: 515,
    y: 635.7,
    align: 'left',
    maxWidth: 560,
    minSize: 22,
  },
  dob: {
    font: 'helvetica',
    size: 34,
    color: INK,
    x: 515,
    y: 683.7,
    align: 'left',
    maxWidth: 560,
  },
  course: {
    font: 'helvetica',
    size: 34,
    color: INK,
    x: 1239,
    y: 636.2,
    align: 'left',
    maxWidth: 420,
    minSize: 24,
  },
  number: {
    font: 'helvetica',
    size: 34,
    color: INK,
    x: 1344,
    y: 684.2,
    align: 'left',
    maxWidth: 330,
    minSize: 24,
  },
  issued: {
    font: 'helvetica',
    size: 30,
    color: INK,
    x: 970,
    y: 2392,
    align: 'left',
    maxWidth: 400,
  },
};

@Injectable()
export class CertificateDocumentsService {
  // Template and font bytes are read once and reused; each request builds its own PDFDocument.
  private readonly files = new Map<string, Promise<Buffer>>();

  private asset(relativePath: string): Promise<Buffer> {
    let bytes = this.files.get(relativePath);
    if (!bytes) {
      bytes = readFile(join(ASSETS_DIR, relativePath));
      // Don't cache a failed read: a missing file stays a 500 until fixed, not forever.
      bytes.catch(() => this.files.delete(relativePath));
      this.files.set(relativePath, bytes);
    }
    return bytes;
  }

  async render(
    document: CertificateDocument,
    variant: CertificateVariant,
    data: CertificateData,
  ): Promise<Uint8Array> {
    const course = courseLabel(data.courseTitle);
    if (!course) {
      throw new BadRequestException(
        'Certificates can only be generated for TEFL and TESOL courses.',
      );
    }
    if (!data.certificateNo || !data.issueDate) {
      throw new BadRequestException(
        'Add the certificate number and issue date before generating the certificate.',
      );
    }

    const pdf = await PDFDocument.load(
      await this.asset(`${document}-${variant}.pdf`),
    );
    pdf.registerFontkit(fontkit);
    const fonts = await this.embedFonts(pdf, document);
    const page = pdf.getPage(0);
    const draw = (slot: TextSlot, text: string) =>
      this.draw(pdf, page, fonts, slot, text);
    const name = printedName(data.passportName);
    const issued = formatIssueDate(data.issueDate);

    if (document === 'certificate') {
      const layout = CERTIFICATE_LAYOUT[variant];
      await draw(
        layout.course,
        `This certificate has been issued upon completion of ${course.label} course by`,
      );
      await draw(layout.name, name);
      await draw(layout.number, `Certificate Number : ${data.certificateNo}`);
      await draw(layout.issued, `Date of Issue : ${issued}`);
    } else {
      const layout = TRANSCRIPT_LAYOUT;
      await draw(layout.name, name);
      await draw(layout.dob, formatDateOfBirth(data.dateOfBirth));
      await draw(layout.programme, `${course.programme})`);
      await draw(layout.course, course.label);
      await draw(layout.number, data.certificateNo);
      await draw(layout.issued, issued);
    }

    const label =
      document === 'certificate' ? 'Certificate' : 'Official Transcript';
    pdf.setTitle(`${label} — ${name} — ${data.certificateNo}`);
    pdf.setAuthor('TESOL TEFL Council');
    pdf.setCreator('TESOL TEFL Council');
    pdf.setProducer('TESOL TEFL Council');
    return pdf.save();
  }

  // Only what the document uses: the transcript needs Lato Bold for its heading, not Garamond.
  private async embedFonts(
    pdf: PDFDocument,
    document: CertificateDocument,
  ): Promise<Fonts> {
    const fonts: Fonts = {
      helvetica: await pdf.embedFont(StandardFonts.Helvetica),
      latoBold: await pdf.embedFont(await this.asset('fonts/Lato-Bold.ttf'), {
        subset: true,
      }),
    };
    if (document === 'certificate') {
      fonts.helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      // Not subset at runtime: pdf-lib's subsetter drops glyphs from this font. The file is already
      // cut down to Latin ranges (see assets/certificates/README.md), so embedding it whole is ~90 KB.
      fonts.garamondItalic = await pdf.embedFont(
        await this.asset('fonts/EBGaramond-Italic.ttf'),
        { subset: false },
      );
    }
    return fonts;
  }

  private async draw(
    pdf: PDFDocument,
    page: PDFPage,
    fonts: Fonts,
    slot: TextSlot,
    text: string,
  ): Promise<void> {
    let font = fonts[slot.font];
    if (!font) throw new Error(`Font ${slot.font} not embedded`);
    // Helvetica only encodes WinAnsi (Latin-1-ish), so "Łukasz" or "Şahin" would throw; the
    // Garamond file holds Latin only. Fall back to Lato, embedded only when a value needs it.
    if (!canEncode(font, text)) {
      fonts.latoRegular ??= await pdf.embedFont(
        await this.asset('fonts/Lato-Regular.ttf'),
        { subset: true },
      );
      font = fonts.latoRegular;
    }

    let size = slot.size;
    const width = font.widthOfTextAtSize(text, size);
    if (width > slot.maxWidth)
      size = Math.max(
        slot.minSize ?? slot.size * 0.7,
        (size * slot.maxWidth) / width,
      );

    const drawnWidth = font.widthOfTextAtSize(text, size);
    const x = slot.align === 'center' ? slot.x - drawnWidth / 2 : slot.x;
    page.drawText(text, {
      x,
      y: page.getHeight() - slot.y,
      size,
      font,
      color: slot.color,
    });
  }
}

// Standard fonts throw on characters outside their encoding; embedded fonts silently draw a blank
// box for missing glyphs, so for those check the font's character set instead.
function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
  } catch {
    return false;
  }
  const available = new Set(font.getCharacterSet());
  return [...text].every((ch) => available.has(ch.codePointAt(0) ?? 0));
}
