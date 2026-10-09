import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Logs `METHOD url -> status latency` for every request. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const status = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
          this.logger.log(`${method} ${originalUrl} -> ${status} ${Date.now() - startedAt}ms`);
        },
        // Errors are logged by AllExceptionsFilter; only record the timing here.
        error: () => {
          this.logger.warn(`${method} ${originalUrl} -> error ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
