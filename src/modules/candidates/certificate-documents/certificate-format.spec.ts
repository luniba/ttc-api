import {
  documentFilename,
  formatDateOfBirth,
  formatIssueDate,
  printedName,
  teflCourseLabel,
} from './certificate-format';

describe('certificate-format', () => {
  it('derives the TEFL label from the course title', () => {
    expect(teflCourseLabel('Advanced 120-Hour TEFL Course')).toBe(
      '120-Hour TEFL',
    );
    expect(teflCourseLabel('Advanced 180-Hour TEFL Course')).toBe(
      '180-Hour TEFL',
    );
    expect(teflCourseLabel('120 hour tefl')).toBe('120-Hour TEFL');
    expect(teflCourseLabel('TEFL Foundations')).toBe('TEFL');
  });

  it('refuses non-TEFL courses', () => {
    expect(teflCourseLabel('Advanced 120-Hour TESOL Course')).toBeNull();
    expect(teflCourseLabel('A-Level Advanced Football Course')).toBeNull();
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
