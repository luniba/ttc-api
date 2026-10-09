/** Name of the httpOnly cookie carrying the rotating refresh token. */
export const REFRESH_COOKIE = 'lms_rt';

// Deliberately not httpOnly: the frontend reads it to echo back in X-CSRF-Token (double-submit pattern).
export const CSRF_COOKIE = 'lms_csrf';

/** Header the CSRF cookie value must be echoed in. */
export const CSRF_HEADER = 'x-csrf-token';

// Re-exported from the canonical set rather than redeclared, so the two lists can't drift.
export { ErrorCode as AuthErrorCode } from '../../common/constants/error-codes';
