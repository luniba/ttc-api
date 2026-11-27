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

export type Programme = 'TEFL' | 'TESOL';

// "Advanced 120-Hour TESOL Course" → { programme: 'TESOL', label: '120-Hour TESOL' }. Null for a
// course that is neither (no design for it). The first of TEFL / TESOL in the title wins.
export function courseLabel(
  courseTitle: string,
): { programme: Programme; label: string } | null {
  const found = /\b(TEFL|TESOL)\b/i.exec(courseTitle);
  if (!found) return null;
  const programme = found[1].toUpperCase() as Programme;
  const hours = new RegExp(
    `(\\d+)\\s*-?\\s*hours?\\s+${programme}\\b`,
    'i',
  ).exec(courseTitle);
  return {
    programme,
    label: hours ? `${hours[1]}-Hour ${programme}` : programme,
  };
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
