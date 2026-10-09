import type { ValueTransformer } from 'typeorm';

// pg returns `numeric` as a string (floats can't represent it exactly); without this, `price * qty` silently becomes string concatenation.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,

  from: (value: string | null): number | null =>
    value === null ? null : Number.parseFloat(value),
};
