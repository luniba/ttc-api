import {
  documentFilename,
  formatDateOfBirth,
  formatIssueDate,
  printedName,
  courseLabel,
} from './certificate-format';

describe('certificate-format', () => {
  it('derives the programme and label from the course title', () => {
    expect(courseLabel('Advanced 120-Hour TEFL Course')).toEqual({
      programme: 'TEFL',
      label: '120-Hour TEFL',
    });
    expect(courseLabel('Advanced 180-Hour TESOL Course')).toEqual({
      programme: 'TESOL',
      label: '180-Hour TESOL',
    });
    expect(courseLabel('120 hour tesol')?.label).toBe('120-Hour TESOL');
    expect(courseLabel('TEFL Foundations')?.label).toBe('TEFL');
  });

  it('refuses courses that are neither TEFL nor TESOL', () => {
    expect(courseLabel('A-Level Advanced Football Course')).toBeNull();
    expect(courseLabel('Teflon basics')).toBeNull();
  });

  it('formats dates as the designs print them', () => {
    expect(formatDateOfBirth('1998-10-25')).toBe('25/10/1998');
    expect(formatIssueDate('2026-11-23')).toBe('23-11-2026');
  });

  it('prints names in capitals with single spaces', () => {
    expect(printedName('  Hiyari   mohamed ')).toBe('HIYARI MOHAMED');
  });

  it('builds a header-safe filename', () => {
    expect(documentFilename('TTC-1132-8345', 'certificate', 'print')).toBe(
      'TTC-1132-8345-certificate-print.pdf',
    );
    expect(documentFilename('TTC/1132 "x"', 'transcript', 'digital')).toBe(
      'TTC1132x-transcript-digital.pdf',
    );
  });
});
