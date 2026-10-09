// Escapes LIKE/ILIKE wildcards (% and _) so a literal search like "50%" doesn't silently match every row.
export const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);
