import { generateCertificateId } from './certificate-id';

describe('generateCertificateId', () => {
  it('matches the printed format and varies', () => {
    const ids = Array.from({ length: 200 }, generateCertificateId);
    for (const id of ids) expect(id).toMatch(/^[a-z]{5}-tesoltefl-\d{5}$/);
    expect(new Set(ids).size).toBeGreaterThan(195);
  });
});
