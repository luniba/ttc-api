export interface UploadInput {
  buffer: Buffer;
  // Used only to derive the extension.
  filename: string;
  mimeType: string;
  folder?: string;
}

export interface UploadResult {
  // What actually gets persisted in the database.
  key: string;
  // Derived from the key, never stored — it changes with the CDN.
  url: string;
  size: number;
  mimeType: string;
}

// Consumers inject this abstract class, never a concrete driver, so swapping backends is a wiring change, not a call-site edit.
// Persist `key`, not `url`: the key is stable for the object's life, while the URL changes whenever infra moves.
export abstract class StorageService {
  abstract upload(input: UploadInput): Promise<UploadResult>;

  /** Public URL for a key. Assumes the bucket/prefix is publicly readable. */
  abstract getUrl(key: string): string;

  /** Time-limited URL for private objects. */
  abstract getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  abstract delete(key: string): Promise<void>;

  // Private bucket (paid course materials): never publicly readable, only via signed URLs.
  abstract uploadPrivate(input: UploadInput): Promise<Omit<UploadResult, 'url'>>;

  /** Signed GET on the private bucket that downloads as `fileName` (Content-Disposition: attachment). */
  abstract getPrivateDownloadUrl(
    key: string,
    fileName: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  abstract deletePrivate(key: string): Promise<void>;
}
