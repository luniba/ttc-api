import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, codeForStatus } from '../constants/error-codes';
import type { ErrorResponse } from '../types/api-response';

// Turns every thrown error into the error envelope; non-HttpException errors become a generic 500 since their
// message can leak connection strings or query fragments, so the detail is logged server-side, not returned.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string = ErrorCode.INTERNAL_ERROR;

    // body-parser throws a raw Error, not an HttpException, when a payload exceeds the limit — handle it separately or it becomes a generic 500.
    const raw = exception as { type?: string; status?: number; limit?: number };
    if (raw?.type === 'entity.too.large') {
      const body: ErrorResponse = {
        success: false,
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: {
          code: ErrorCode.PAYLOAD_TOO_LARGE,
          message: `Request body is too large${raw.limit ? ` (limit ${raw.limit} bytes)` : ''}`,
        },
        path: request.url,
        timestamp: new Date().toISOString(),
      };
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
        code = codeForStatus(status);
      } else {
        const body = payload as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        // Fall back to a status-derived code so `code` is never absent.
        code = (body.code as string) ?? codeForStatus(status);

        // ValidationPipe's 400 has an array message — distinct enough to deserve its own code.
        if (status === HttpStatus.BAD_REQUEST && Array.isArray(message) && !body.code) {
          code = ErrorCode.VALIDATION_ERROR;
        }
      }

      // ThrottlerException's default message leaks an internal class name; replace it with plain English.
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        message = 'Too many requests. Please slow down and try again shortly.';
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      success: false,
      statusCode: status,
      error: { code, message },
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
