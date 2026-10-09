import { HttpStatus } from '@nestjs/common';

// Canonical error codes; clients branch on these, so they must stay stable even if the message text changes.
export const ErrorCode = {
  // Generic — derived from the HTTP status when a handler does not supply one.
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Auth — see modules/auth/auth.constants.ts for where these are thrown.
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_SESSION: 'INVALID_SESSION',
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',
  CSRF_FAILED: 'CSRF_FAILED',
  // Includes soft-deleted rows, which still hold the unique index.
  EMAIL_TAKEN: 'EMAIL_TAKEN',

  // Courses — see modules/courses.
  CATEGORY_TAKEN: 'CATEGORY_TAKEN',
  // Includes soft-deleted courses, which still hold the unique index.
  SLUG_TAKEN: 'SLUG_TAKEN',
  // Module exists but the caller may not read it (not a preview module).
  MODULE_LOCKED: 'MODULE_LOCKED',

  // Candidates — see modules/candidates. Includes soft-deleted candidates, which still hold the unique index.
  CERTIFICATE_NO_TAKEN: 'CERTIFICATE_NO_TAKEN',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// A lookup rather than a switch, since HttpException.getStatus() returns a plain number and switching on HttpStatus enum members is unsound.
const STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

// Fallback so error.code is always populated even for a plain Nest exception.
export function codeForStatus(status: number): string {
  // Literal 500, not HttpStatus.INTERNAL_SERVER_ERROR: status is a plain number and the enum has no ordering guarantee.
  return (
    STATUS_TO_CODE[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST)
  );
}
