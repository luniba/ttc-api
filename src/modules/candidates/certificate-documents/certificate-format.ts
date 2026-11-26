// Pure helpers for the printed certificate and transcript: no I/O, so they're unit-tested directly.

export type CertificateDocument = 'certificate' | 'transcript';
export type CertificateVariant = 'digital' | 'print';

export const CERTIFICATE_DOCUMENTS: readonly CertificateDocument[] = [
  'certificate',
  'transcript',
];
export const CERTIFICATE_VARIANTS: readonly CertificateVariant[] = [
  'digital',
  'print',
];

// "Advanced 120-Hour TEFL Course" → "120-Hour TEFL". Null when the title isn't a TEFL course: the
// templates' transcript lists the TEFL modules, so other courses have no design yet.
export function teflCourseLabel(courseTitle: string): string | null {
  const match = /(\d+)\s*-?\s*hours?\s+TEFL\b/i.exec(courseTitle);
  if (match) return `${match[1]}-Hour TEFL`;
  return /\bTEFL\b/i.test(courseTitle) ? 'TEFL' : null;
}

// "1998-10-25" → "25/10/1998" (date of birth, as on the transcript).
export function formatDateOfBirth(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

// "2026-11-23" → "23-11-2026" (issue date, as on both documents).
export function formatIssueDate(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}-${m}-${y}`;
}

// Names print in capitals, matching the designs. Collapses runs of whitespace typed into the form.
export function printedName(passportName: string): string {
  return passportName.trim().replace(/\s+/g, ' ').toLocaleUpperCase('en');
}

// Filename for the download: "TTC-1132-8345-certificate-print.pdf". Anything outside
// [A-Za-z0-9-] is dropped so the Content-Disposition header never needs escaping.
export function documentFilename(
  certificateNo: string,
  document: CertificateDocument,
  variant: CertificateVariant,
): string {
  const safe = certificateNo.replace(/[^A-Za-z0-9-]+/g, '') || 'certificate';
  return `${safe}-${document}-${variant}.pdf`;
}

// ParseEnumPipe wants an enum-shaped object; build one from a list of string literals.
export function enumOf<T extends string>(values: readonly T[]): Record<T, T> {
  return Object.fromEntries(values.map((v) => [v, v])) as Record<T, T>;
}
