#!/usr/bin/env node
/**
 * Upload a local audio file to a fixed key under the public R2 bucket
 * (e.g. `public/music/…` for built-in / CDN-style paths).
 *
 * Usage:
 *   node scripts/upload-public-music.mjs <local-path> [r2-key]
 *
 * Example:
 *   node scripts/upload-public-music.mjs "../Calm Music.mp3" public/music/sappheiros-dawn-calm.mp3
 *
 * Batch uploads: `upload-public-music-from-manifest.mjs` + `r2-public-music-manifest.json`.
 *
 * Loads repo-root `.env` the same way as `test-r2.mjs` (does not override existing process.env).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findRepoRoot(start) {
  let cur = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(cur, 'pnpm-workspace.yaml'))) return cur;
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

const repoRoot = findRepoRoot(__dirname);
const envPath = repoRoot ? resolve(repoRoot, '.env') : resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
} else {
  console.error(`⚠️  No .env found (looked at ${envPath})`);
}

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const localPath = process.argv[2];
if (!localPath) {
  console.error('Usage: node scripts/upload-public-music.mjs <local-path> [r2-key]');
  process.exit(1);
}

const resolvedLocal = resolve(process.cwd(), localPath);
if (!existsSync(resolvedLocal)) {
  console.error(`❌ File not found: ${resolvedLocal}`);
  process.exit(1);
}

const defaultKey = `public/music/${basename(resolvedLocal).replace(/[^a-zA-Z0-9._-]/g, '-')}`;
const r2Key = (process.argv[3] || defaultKey).replace(/^\/+/, '');

const ext = r2Key.split('.').pop()?.toLowerCase();
const contentType =
  ext === 'mp3'
    ? 'audio/mpeg'
    : ext === 'm4a' || ext === 'aac'
      ? 'audio/mp4'
      : ext === 'wav'
        ? 'audio/wav'
        : ext === 'flac'
          ? 'audio/flac'
          : ext === 'ogg'
            ? 'audio/ogg'
            : 'application/octet-stream';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const body = readFileSync(resolvedLocal);

async function main() {
  console.log('→ Uploading…');
  console.log(`   local:  ${resolvedLocal} (${body.length} bytes)`);
  console.log(`   bucket: ${R2_BUCKET_NAME}`);
  console.log(`   key:    ${r2Key}`);
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=86400',
    }),
  );
  const url = `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${r2Key}`;
  console.log(`\n✅ Uploaded\n   ${url}`);
}

main().catch((e) => {
  console.error('Upload failed:', e.message ?? e);
  process.exit(2);
});
