import { randomInt } from 'crypto';

// No look-alikes (0/O, 1/l/I): these get read off an email.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

const pick = (chars: string): string => chars[randomInt(chars.length)];

// 12 characters, always with a letter and a digit.
export function generatePassword(length = 12): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates shuffle.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
