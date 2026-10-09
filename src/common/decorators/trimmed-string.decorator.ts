import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Trims before validating: @IsNotEmpty() alone would pass "   ", letting a whitespace-only value reach the database.
export function TrimmedString(maxLength: number): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
    MaxLength(maxLength),
  );
}
