import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  Matches,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

/** bcrypt silently ignores everything past this many BYTES of input. */
const BCRYPT_MAX_BYTES = 72;

// @MaxLength(72) is NOT equivalent: it counts UTF-16 code units, while bcrypt truncates at 72 UTF-8 bytes, so two different
// passwords sharing a 72-byte prefix could both authenticate. Measuring bytes closes that hole.
function MaxPasswordBytes(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'maxPasswordBytes',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES
          );
        },
        defaultMessage(): string {
          return `Password must be at most ${BCRYPT_MAX_BYTES} bytes — accented and non-Latin characters use more than one byte each`;
        },
      },
    });
  };
}

// Defined once and reused by every password field so the policy can't drift between endpoints.
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters' }),
    MaxPasswordBytes(),
    Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
      message: 'Password must contain at least one letter and one number',
    }),
  );
}
