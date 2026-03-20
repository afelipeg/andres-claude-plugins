// ─── Cloudflare R2 Client ────────────────────────────────────────────
// S3-compatible object storage for Knowledge Base documents.
// Key convention: {agency_id}/{client_id}/{folder_path}/{filename}

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified?: Date;
  etag?: string;
}

function getConfig(): R2Config {
  const accountId = process.env['R2_ACCOUNT_ID'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
  const bucketName = process.env['R2_BUCKET_NAME'] ?? 'openagency-kb';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

let _client: S3Client | null = null;
let _config: R2Config | null = null;

function getClient(): { client: S3Client; config: R2Config } {
  if (!_client || !_config) {
    _config = getConfig();
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${_config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: _config.accessKeyId,
        secretAccessKey: _config.secretAccessKey,
      },
    });
  }
  return { client: _client, config: _config };
}

/**
 * Build a standardized R2 key.
 */
export function buildR2Key(
  agencyId: string,
  clientId: string,
  folderPath: string,
  filename: string,
): string {
  return `${agencyId}/${clientId}/${folderPath}/${filename}`.replace(/\/+/g, '/');
}

/**
 * Upload a file to R2.
 */
export async function upload(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType ?? 'application/octet-stream',
    }),
  );
}

/**
 * Download a file from R2.
 */
export async function download(key: string): Promise<Buffer> {
  const { client, config } = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
  const stream = response.Body;
  if (!stream) throw new Error(`Empty body for key: ${key}`);
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — Body is a readable stream in Node
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

/**
 * Get a presigned download URL (GET).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const { client, config } = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- smithy @4.13.0 vs @4.13.1 version mismatch
  return (getSignedUrl as any)(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    { expiresIn },
  ) as Promise<string>;
}

/**
 * Get a presigned upload URL (PUT).
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType?: string,
  expiresIn = 3600,
): Promise<string> {
  const { client, config } = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- smithy @4.13.0 vs @4.13.1 version mismatch
  return (getSignedUrl as any)(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: contentType ?? 'application/octet-stream',
    }),
    { expiresIn },
  ) as Promise<string>;
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(key: string): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
}

/**
 * List objects by prefix.
 */
export async function listObjects(prefix: string): Promise<R2Object[]> {
  const { client, config } = getClient();
  const result: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (obj.Key) {
        result.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified,
          etag: obj.ETag,
        });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return result;
}
