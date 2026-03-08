// ─── File Storage Abstraction ────────────────────────────────────────
// Two backends:
//   - LocalFileStorage  (dev): writes to FILE_STORAGE_DIR or /tmp/openagency-files
//   - S3FileStorage     (prod): writes to S3-compatible bucket via FILE_STORAGE_URL
//
// Factory: createFileStorage() reads FILE_STORAGE_URL to choose backend.
// S3 URL format: s3://bucket-name[/prefix]
// S3 credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION
//   or S3_ENDPOINT for non-AWS providers (R2, MinIO, etc.)

import fs from 'node:fs';
import path from 'node:path';

// ─── Interface ───────────────────────────────────────────────────────

export interface FileStorageBackend {
  /**
   * Persist a locally-generated file to the storage backend.
   * @param localPath  Absolute path of the temp file to upload.
   * @param destKey    Logical storage key (e.g. "acme/2026-03/report.pdf").
   * @returns The stored key (same as destKey for local, S3 object key for S3).
   */
  save(localPath: string, destKey: string): Promise<string>;

  /**
   * Build a download URL for a stored key.
   * For local backend this is an API endpoint; for S3 it is a presigned URL.
   */
  getDownloadUrl(storedKey: string, fileId: string): string;

  /**
   * Remove a stored file. Errors are silently swallowed (best-effort).
   */
  delete(storedKey: string): Promise<void>;

  /**
   * Read the raw bytes of a stored file (needed to serve downloads locally).
   */
  readBuffer(storedKey: string): Promise<Buffer>;
}

// ─── Key helpers ─────────────────────────────────────────────────────

/** Build a canonical storage key from file metadata. */
export function buildStorageKey(
  clientId: string,
  fileId: string,
  fileType: string,
  skillId: string,
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${clientId}/${year}-${month}/${skillId}/${fileId}.${fileType}`;
}

/** Absolute tmp path for generator output before storage upload. */
export function buildTempPath(fileId: string, fileType: string): string {
  const tmpDir = process.env['TMPDIR'] ?? '/tmp';
  return path.join(tmpDir, `openagency-${fileId}.${fileType}`);
}

// ─── Local Backend ───────────────────────────────────────────────────

export class LocalFileStorage implements FileStorageBackend {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(baseDir?: string, baseUrl?: string) {
    this.baseDir = baseDir ?? process.env['FILE_STORAGE_DIR'] ?? '/tmp/openagency-files';
    this.baseUrl = baseUrl ?? process.env['API_BASE_URL'] ?? 'http://localhost:3100';
  }

  async save(localPath: string, destKey: string): Promise<string> {
    const dest = path.join(this.baseDir, destKey);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(localPath, dest);
    // Remove temp file after copying
    await fs.promises.unlink(localPath).catch(() => {});
    return destKey;
  }

  getDownloadUrl(_storedKey: string, fileId: string): string {
    return `${this.baseUrl}/v1/delivery/files/${fileId}/download`;
  }

  async delete(storedKey: string): Promise<void> {
    const dest = path.join(this.baseDir, storedKey);
    await fs.promises.unlink(dest).catch(() => {});
  }

  async readBuffer(storedKey: string): Promise<Buffer> {
    const dest = path.join(this.baseDir, storedKey);
    return fs.promises.readFile(dest);
  }
}

// ─── S3 Backend ──────────────────────────────────────────────────────

export class S3FileStorage implements FileStorageBackend {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly publicBase: string;

  constructor(s3Url: string) {
    // Parse s3://bucket-name[/prefix]
    const url = new URL(s3Url.replace('s3://', 'http://'));
    this.bucket = url.hostname;
    this.prefix = url.pathname.replace(/^\//, '');
    this.region = process.env['AWS_REGION'] ?? 'us-east-1';
    this.endpoint = process.env['S3_ENDPOINT']; // optional custom endpoint (R2, MinIO)
    this.publicBase = process.env['API_BASE_URL'] ?? 'http://localhost:3100';
  }

  private async getClient() {
    // Lazy import to avoid loading AWS SDK when using local backend
    const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } =
      await import('@aws-sdk/client-s3');
    const config: Record<string, unknown> = {
      region: this.region,
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
      },
    };
    if (this.endpoint) config['endpoint'] = this.endpoint;
    return { client: new S3Client(config), PutObjectCommand, DeleteObjectCommand, GetObjectCommand };
  }

  private objectKey(destKey: string): string {
    return this.prefix ? `${this.prefix}/${destKey}` : destKey;
  }

  async save(localPath: string, destKey: string): Promise<string> {
    const { client, PutObjectCommand } = await this.getClient();
    const buffer = await fs.promises.readFile(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(destKey),
        Body: buffer,
        ContentType: mimeType(destKey),
      }),
    );
    await fs.promises.unlink(localPath).catch(() => {});
    return destKey;
  }

  getDownloadUrl(_storedKey: string, fileId: string): string {
    // Serve via API proxy — client never gets raw S3 URL
    return `${this.publicBase}/v1/delivery/files/${fileId}/download`;
  }

  async delete(storedKey: string): Promise<void> {
    try {
      const { client, DeleteObjectCommand } = await this.getClient();
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storedKey) }),
      );
    } catch {
      // best-effort
    }
  }

  async readBuffer(storedKey: string): Promise<Buffer> {
    const { client, GetObjectCommand } = await this.getClient();
    const resp = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storedKey) }),
    );
    const body = resp.Body;
    if (!body) throw new Error('S3: empty body');
    // @aws-sdk/client-s3 body is a ReadableStream in Node
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ─── MIME helpers ────────────────────────────────────────────────────

function mimeType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}

// ─── Factory ─────────────────────────────────────────────────────────

let _instance: FileStorageBackend | null = null;

export function createFileStorage(): FileStorageBackend {
  if (_instance) return _instance;
  const fileStorageUrl = process.env['FILE_STORAGE_URL'];
  if (fileStorageUrl?.startsWith('s3://')) {
    _instance = new S3FileStorage(fileStorageUrl);
  } else {
    _instance = new LocalFileStorage();
  }
  return _instance;
}

/** Reset singleton (useful in tests). */
export function resetFileStorage(): void {
  _instance = null;
}
