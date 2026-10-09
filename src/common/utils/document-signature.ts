import { extname } from 'path';

// Identifies a course-material document by its magic bytes (like image-signature.ts); the declared Content-Type is the client's claim, not evidence.
// ZIP and OLE are containers shared by several formats, so the file extension picks the format and the bytes must agree with it.

export interface DocumentType {
  ext: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx';
  mimeType: string;
}

const TYPES: Record<DocumentType['ext'], string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const PDF = Buffer.from('%PDF-', 'ascii');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

// OOXML part names are stored uncompressed in the ZIP headers, so a plain byte search tells a .docx from a .pptx (or a random .zip).
const OOXML_MARKER: Partial<Record<DocumentType['ext'], string>> = {
  docx: 'word/',
  pptx: 'ppt/',
};

/** Returns the document type when the bytes match the file's extension, or null (reject). */
export function detectDocumentType(buffer: Buffer, fileName: string): DocumentType | null {
  const ext = extname(fileName).slice(1).toLowerCase() as DocumentType['ext'];
  const head = (signature: Buffer): boolean =>
    buffer.subarray(0, signature.length).equals(signature);

  let ok: boolean;
  switch (ext) {
    case 'pdf':
      ok = head(PDF);
      break;
    case 'doc':
    case 'ppt':
      ok = head(OLE);
      break;
    case 'docx':
    case 'pptx':
      ok = head(ZIP) && buffer.includes(OOXML_MARKER[ext]!, 0, 'ascii');
      break;
    default:
      return null;
  }

  return ok ? { ext, mimeType: TYPES[ext] } : null;
}
