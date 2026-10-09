// NFKD + stripping combining marks folds accents to ASCII (café -> cafe) instead of dropping them (which would give "caf").
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

// Appends -2, -3, ... until `exists` says otherwise, rather than failing the request on a name collision.
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';

  if (!(await exists(root))) {
    return root;
  }

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  // Pathological: 1000 rows with the same name. Fall back to a random tail
  // rather than looping forever.
  return `${root}-${Date.now().toString(36)}`;
}
