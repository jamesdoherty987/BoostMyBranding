#!/usr/bin/env node
/**
 * R2 smoke test.
 *
 * Uploads a 1×1 PNG to the configured bucket, fetches it back via the
 * Public Development URL, and then deletes it. Exits non-zero if any
 * step fails so CI (and humans) get a fast, clear signal that R2 is
 * wired up correctly.
 *
 * Run with:
 *   node scripts/test-r2.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Load .env from the repo root without pulling in a dependency.
// Walks up from this file's directory until we find a pnpm-workspace.yaml
// (the repo root marker) and loads its .env.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findRepoRoot(start) {
  let cur = start;
  for (let i = 0; i < 6; i++) {
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

// 1×1 transparent PNG as a Buffer.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const key = `__bmb-smoke-test__/${Date.now()}-pixel.png`;

async function main() {
  console.log('→ 1. Uploading to R2…');
  console.log(`   bucket: ${R2_BUCKET_NAME}`);
  console.log(`   key:    ${key}`);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: PNG_1X1,
        ContentType: 'image/png',
      }),
    );
    console.log('   ✓ PUT succeeded');
  } catch (e) {
    console.error(`   ✗ PUT failed: ${e.message}`);
    diagnoseAwsError(e);
    process.exit(2);
  }

  const publicUrl = `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
  console.log(`\n→ 2. Fetching via Public Development URL…`);
  console.log(`   url: ${publicUrl}`);

  try {
    const res = await fetch(publicUrl);
    if (!res.ok) {
      console.error(`   ✗ GET failed: ${res.status} ${res.statusText}`);
      if (res.status === 404) {
        console.error(
          '     404 usually means the Public Development URL is not enabled for this bucket,',
        );
        console.error(
          '     or the URL in R2_PUBLIC_URL does not match the bucket. Check Bucket → Settings → Public Development URL.',
        );
      }
      if (res.status === 403) {
        console.error(
          '     403 means the bucket is private. Enable Public Development URL in bucket settings.',
        );
      }
      process.exit(3);
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length !== PNG_1X1.length) {
      console.error(
        `   ✗ Content mismatch: expected ${PNG_1X1.length} bytes, got ${body.length}`,
      );
      process.exit(4);
    }
    console.log(`   ✓ GET succeeded (${body.length} bytes matched)`);
  } catch (e) {
    console.error(`   ✗ GET network error: ${e.message}`);
    process.exit(5);
  }

  console.log('\n→ 3. Deleting the test object…');
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
    );
    console.log('   ✓ DELETE succeeded');
  } catch (e) {
    console.warn(`   ! DELETE failed (non-fatal): ${e.message}`);
  }

  console.log('\n✅ R2 is wired up correctly. You can upload from the dashboard.');
}

function diagnoseAwsError(e) {
  const msg = e.message ?? '';
  if (/InvalidAccessKeyId/i.test(msg)) {
    console.error('     R2_ACCESS_KEY_ID is wrong.');
  } else if (/SignatureDoesNotMatch/i.test(msg)) {
    console.error('     R2_SECRET_ACCESS_KEY is wrong.');
  } else if (/NoSuchBucket/i.test(msg)) {
    console.error(`     Bucket "${R2_BUCKET_NAME}" does not exist in this account.`);
  } else if (/AccessDenied/i.test(msg)) {
    console.error(
      '     The token is valid but lacks Object Read & Write permission on this bucket.',
    );
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(99);
});
