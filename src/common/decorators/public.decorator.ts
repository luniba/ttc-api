import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opts a route out of the global JwtAuthGuard; auth is on by default so a new route fails locked, not open.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
