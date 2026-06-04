/**
 * Cloudflare R2 wrapper (S3-compatible). Uploads are scoped per-client:
 *   {bucket}/{clientId}/{yyyymm}/{uuid}-{filename}
 *
 * In dev without R2 credentials, we store files on local disk under
 * `apps/api/tmp/uploads` and serve them via the /uploads static route.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
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

/** Base URL for `/uploads/…` when storing files on local disk (no R2). */
function localUploadsBaseUrl(): string {
  if (env.NODE_ENV === 'production') {
    return (env.API_PUBLIC_URL?.trim() || env.APP_URL).replace(/\/+$/, '');
  }
  return `http://127.0.0.1:${env.API_PORT}`;
}

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
    // URLs must use `/` — on Windows `relative` contains `\`, which breaks fetch().
    const urlRel = relative.split(path.sep).join('/');
    return {
      key: relative,
      url: `${localUploadsBaseUrl()}/uploads/${urlRel}`,
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

  const base = env.R2_PUBLIC_URL?.trim();
  if (!base) {
    throw new Error(
      'R2_PUBLIC_URL is required when R2 is enabled — without it returned URLs are not fetchable (voice/music download during stitch would fail).',
    );
  }
  const baseNorm = base.replace(/\/+$/, '');
  const keyNorm = key.replace(/^\/+/, '');
  const url = `${baseNorm}/${keyNorm}`;
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
    const k = key.split(path.sep).join('/');
    return `${localUploadsBaseUrl()}/uploads/${k}`;
  }
  return getSignedUrl(
    client()!,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: key }),
    { expiresIn },
  );
}

export function localUploadDir() {
  return LOCAL_UPLOAD_DIR;
}

const MUSIC_KEY_EXT = /\.(mp3|m4a|aac|wav|flac|ogg)$/i;

export type ListMusicKeysOptions = {
  /** Stop after this many keys (safety). Default 50_000. */
  maxKeys?: number;
  /** Stop after this many ListObjects pages (500 keys each). Default 200. */
  maxPages?: number;
};

const DEFAULT_MAX_MUSIC_KEYS = 50_000;
const DEFAULT_MAX_PAGES = 200;

/**
 * Lists every object key under `prefix` that looks like an audio file, using
 * full ListObjectsV2 pagination until the listing completes or caps hit.
 */
export async function listMusicAssetKeysUnderPrefix(
  prefix: string,
  opts?: ListMusicKeysOptions,
): Promise<string[]> {
  if (!features.r2 || !client() || !env.R2_BUCKET_NAME?.trim()) return [];
  const maxKeys = opts?.maxKeys ?? DEFAULT_MAX_MUSIC_KEYS;
  const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;
  const pref = prefix.replace(/^\/+/, '').replace(/\/?$/, '/');
  const keys: string[] = [];
  let continuationToken: string | undefined;
  let pages = 0;
  do {
    pages += 1;
    if (pages > maxPages) {
      console.warn(
        `[r2] listMusicAssetKeysUnderPrefix: hit maxPages=${maxPages} under "${pref}" — returning partial list (${keys.length} keys).`,
      );
      break;
    }
    const out = await client()!.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: pref,
        ContinuationToken: continuationToken,
        MaxKeys: 500,
      }),
    );
    for (const o of out.Contents ?? []) {
      const k = o.Key;
      if (!k || k.endsWith('/')) continue;
      if (!MUSIC_KEY_EXT.test(k)) continue;
      keys.push(k);
      if (keys.length >= maxKeys) {
        console.warn(
          `[r2] listMusicAssetKeysUnderPrefix: hit maxKeys=${maxKeys} under "${pref}" — returning truncated list.`,
        );
        return keys.sort((a, b) => a.localeCompare(b));
      }
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort((a, b) => a.localeCompare(b));
}
