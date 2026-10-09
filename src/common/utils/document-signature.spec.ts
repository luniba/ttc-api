import { detectDocumentType } from './document-signature';

const zip = (entry: string) =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`....${entry}document.xml`)]);
const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);

describe('detectDocumentType', () => {
  it('accepts matching bytes and extension', () => {
    expect(detectDocumentType(Buffer.from('%PDF-1.4 ...'), 'a.PDF')?.ext).toBe('pdf');
    expect(detectDocumentType(zip('word/'), 'a.docx')?.ext).toBe('docx');
    expect(detectDocumentType(zip('ppt/'), 'a.pptx')?.ext).toBe('pptx');
    expect(detectDocumentType(ole, 'a.doc')?.ext).toBe('doc');
    expect(detectDocumentType(ole, 'a.ppt')?.ext).toBe('ppt');
  });

  it('rejects mismatches and other types', () => {
    expect(detectDocumentType(Buffer.from('hello'), 'a.pdf')).toBeNull();
    expect(detectDocumentType(zip('word/'), 'a.pptx')).toBeNull();
    expect(detectDocumentType(Buffer.from('%PDF-1.4'), 'a.docx')).toBeNull();
    expect(detectDocumentType(Buffer.from('%PDF-1.4'), 'a.exe')).toBeNull();
    expect(detectDocumentType(Buffer.from('%PDF-1.4'), 'pdf')).toBeNull();
  });
});
