#!/usr/bin/env node
/**
 * Upload multiple local audio files to R2 under `public/music/` (or custom keys).
 *
 * Usage:
 *   cd apps/api
 *   node scripts/upload-public-music-from-manifest.mjs scripts/r2-public-music-manifest.json
 *
 * Manifest: JSON array of `{ "local": "...", "key": "public/music/....mp3" }`.
 * - `local` may use `%USERPROFILE%`, `%HOME%`, etc. (expanded on Windows/macOS/Linux).
 * - `key` optional; defaults to `public/music/` + sanitized basename of local file.
 *
 * Loads repo-root `.env` for R2_* (same as upload-public-music.mjs).
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

function expandEnvPlaceholders(p) {
  if (!p || typeof p !== 'string') return p;
  return p.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? '');
}

function sanitizeKeyFromBasename(name) {
  return `public/music/${basename(name).replace(/[^a-zA-Z0-9._-]/g, '-')}`;
}

function contentTypeForKey(key) {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a' || ext === 'aac') return 'audio/mp4';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'ogg') return 'audio/ogg';
  return 'application/octet-stream';
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

const manifestPathArg = process.argv[2];
if (!manifestPathArg) {
  console.error(
    'Usage: node scripts/upload-public-music-from-manifest.mjs <path-to-manifest.json>',
  );
  process.exit(1);
}

const manifestPath = resolve(process.cwd(), manifestPathArg);
if (!existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

let entries;
try {
  entries = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error('❌ Invalid JSON manifest:', e?.message ?? e);
  process.exit(1);
}

if (!Array.isArray(entries) || entries.length === 0) {
  console.error('❌ Manifest must be a non-empty JSON array of { local, key? }');
  process.exit(1);
}

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

async function main() {
  const base = R2_PUBLIC_URL.replace(/\/+$/, '');
  let ok = 0;
  for (const row of entries) {
    const rawLocal = typeof row.local === 'string' ? row.local : '';
    const local = expandEnvPlaceholders(rawLocal).trim();
    const r2Key =
      typeof row.key === 'string' && row.key.trim()
        ? row.key.trim().replace(/^\/+/, '')
        : sanitizeKeyFromBasename(local);

    const resolvedLocal = resolve(local);
    if (!existsSync(resolvedLocal)) {
      console.warn(`⏭  skip (not found): ${resolvedLocal}`);
      continue;
    }

    const body = readFileSync(resolvedLocal);
    console.log(`→ ${r2Key}  (${body.length} bytes)`);
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: body,
        ContentType: contentTypeForKey(r2Key),
        CacheControl: 'public, max-age=86400',
      }),
    );
    console.log(`   ${base}/${r2Key}`);
    ok += 1;
  }
  console.log(`\n✅ Uploaded ${ok} file(s).`);
}

main().catch((e) => {
  console.error('Upload failed:', e.message ?? e);
  process.exit(2);
});
