import { randomInt } from 'node:crypto';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// "kuqwc-tesoltefl-35620": five random letters, the brand, five random digits. About 1.2
// trillion combinations; a clash is caught by the unique index and retried (see the service).
export function generateCertificateId(): string {
  const letters = Array.from({ length: 5 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
  const digits = String(randomInt(100_000)).padStart(5, '0');
  return `${letters}-tesoltefl-${digits}`;
}
