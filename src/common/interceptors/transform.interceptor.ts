import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Paginated, type SuccessResponse } from '../types/api-response';

// Wraps every successful response in the envelope so controllers can return plain values and stay unaware of it.
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<unknown>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        const timestamp = new Date().toISOString();

        // Counts go in `meta` so `data` stays a plain array regardless of endpoint.
        if (payload instanceof Paginated) {
          return {
            success: true as const,
            data: payload.items,
            meta: { pagination: payload.toMeta() },
            timestamp,
          };
        }

        return { success: true as const, data: payload, timestamp };
      }),
    );
  }
}
