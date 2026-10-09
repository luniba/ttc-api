// Every response is one of these two shapes, discriminated by `success` so a client reads one boolean instead of probing for `data` vs `error`.

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  /** Present only when there is something to say about the payload (paging). */
  meta?: ResponseMeta;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  statusCode: number;
  error: {
    /** Stable, machine-readable. Branch on this — never on `message`. */
    code: string;
    /** Human-readable. An array for field-level validation failures. */
    message: string | string[];
  };
  path: string;
  timestamp: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Marker so TransformInterceptor can lift the counts into meta.pagination and leave `data` a plain array.
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
    readonly page: number,
    readonly limit: number,
  ) {}

  toMeta(): PaginationMeta {
    const pageCount = this.limit > 0 ? Math.ceil(this.total / this.limit) : 0;
    return {
      total: this.total,
      page: this.page,
      limit: this.limit,
      pageCount,
      hasNext: this.page < pageCount,
      hasPrev: this.page > 1,
    };
  }
}
