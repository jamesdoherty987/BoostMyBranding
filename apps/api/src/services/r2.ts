/**
 * Cloudflare R2 wrapper (S3-compatible). Uploads are scoped per-client:
 *   {bucket}/{clientId}/{yyyymm}/{uuid}-{filename}
 *
 * In dev without R2 credentials, we store files on local disk under
 * `apps/api/tmp/uploads` and serve them via the /uploads static route.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env, features } from '../env.js';

let _client: S3Client | null = null;
function client() {
  if (!_client && features.r2) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'tmp', 'uploads');

export async function uploadFile(
  clientId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  const key = `${clientId}/${month}/${randomUUID()}-${safeName}`;

  if (!features.r2 || !client()) {
    const dir = path.join(LOCAL_UPLOAD_DIR, clientId, month);
    await fs.mkdir(dir, { recursive: true });
    const diskPath = path.join(dir, `${randomUUID()}-${safeName}`);
    await fs.writeFile(diskPath, buffer);
    const relative = path.relative(LOCAL_UPLOAD_DIR, diskPath);
    return {
      key: relative,
      url: `${env.NODE_ENV === 'production' ? env.APP_URL : 'http://localhost:4000'}/uploads/${relative}`,
    };
  }

  await client()!.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const url = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key;
  return { key, url };
}

export async function deleteFile(key: string) {
  if (!features.r2 || !client()) {
    await fs.unlink(path.join(LOCAL_UPLOAD_DIR, key)).catch(() => {});
    return;
  }
  await client()!.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: key }),
  );
}

export async function signedUrl(key: string, expiresIn = 3600) {
  if (!features.r2 || !client()) {
    return `${env.APP_URL}/uploads/${key}`;
  }
  return getSignedUrl(
    client()!,
    new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn },
  );
}

export function localUploadDir() {
  return LOCAL_UPLOAD_DIR;
}
