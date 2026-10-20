import { generatePassword } from './generate-password';
import { SecretBox } from './secret-box';

describe('SecretBox', () => {
  const box = new SecretBox('', 'a-long-enough-jwt-secret-for-tests-0123456789');

  it('round-trips a value and never stores it as plain text', () => {
    const sealed = box.encrypt('Abc12345xyz');
    expect(sealed).not.toContain('Abc12345xyz');
    expect(box.decrypt(sealed)).toBe('Abc12345xyz');
  });

  it('uses a fresh IV each time', () => {
    expect(box.encrypt('same')).not.toBe(box.encrypt('same'));
  });

  it('returns null for tampered, malformed or foreign values', () => {
    const sealed = box.encrypt('secret');
    const [v, iv, tag, data] = sealed.split(':');
    expect(box.decrypt(`${v}:${iv}:${tag}:${Buffer.from('x').toString('base64')}`)).toBeNull();
    expect(box.decrypt('garbage')).toBeNull();
    expect(new SecretBox('', 'another-secret-entirely-0123456789abcdef').decrypt(sealed)).toBeNull();
    expect(data).toBeTruthy();
  });

  it('rejects a configured key that is not 32 bytes', () => {
    expect(() => new SecretBox(Buffer.from('short').toString('base64'), 'x')).toThrow(/32 bytes/);
  });
});

describe('generatePassword', () => {
  it('is 12 characters with a letter and a digit, and differs each time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[0OIl1]/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});
