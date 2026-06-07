/**
 * Delete every object under `public/music/` on R2, then upload all `.mp3`
 * files from a local directory (non-recursive).
 *
 * From `apps/api`:
 *   pnpm exec tsx --import ./scripts/load-root-env.ts ./scripts/sync-r2-public-music-folder.ts "C:\path\to\folder"
 *
 * Flags: `--dry-run` (no R2 writes), `--yes` (skip delete confirmation).
 */

import './load-root-env.ts';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const PUBLIC_MUSIC_PREFIX = 'public/music/';

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

function parseArgs(argv: string[]): { dryRun: boolean; yes: boolean; folder: string } {
  let dryRun = false;
  let yes = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--yes') yes = true;
    else rest.push(a);
  }
  const folder = rest[0]?.trim() ?? '';
  return { dryRun, yes, folder };
}

function contentTypeForKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

/** Match `upload-public-music-from-manifest.mjs` basename → key tail. */
function sanitizeBasenameForKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function listAllObjectKeys(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );
    for (const o of out.Contents ?? []) {
      const k = o.Key;
      if (k && !k.endsWith('/')) keys.push(k);
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys.sort((a, b) => a.localeCompare(b));
}

async function deleteKeysBatch(
  client: S3Client,
  bucket: string,
  keys: string[],
  dryRun: boolean,
): Promise<void> {
  const chunkSize = 1000;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    if (dryRun) {
      console.log(`[dry-run] would DeleteObjects ${chunk.length} key(s)`);
      continue;
    }
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }
}

function uniqueKeyForUpload(
  sanitizedBasename: string,
  used: Set<string>,
): string {
  const lower = sanitizedBasename.toLowerCase();
  if (!used.has(lower)) {
    used.add(lower);
    return sanitizedBasename;
  }
  const parsed = path.parse(sanitizedBasename);
  const ext = parsed.ext || '.mp3';
  const stem = parsed.name;
  let n = 1;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

async function confirmOrProceed(
  dryRun: boolean,
  yes: boolean,
  deleteCount: number,
): Promise<boolean> {
  if (dryRun || yes) return true;
  if (deleteCount === 0) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      `About to delete ${deleteCount} object(s) under "${PUBLIC_MUSIC_PREFIX}". Type YES to continue: `,
      resolve,
    );
  });
  rl.close();
  return answer.trim() === 'YES';
}

async function main() {
  const argv = process.argv.slice(2);
  const { dryRun, yes, folder } = parseArgs(argv);

  if (!folder) {
    console.error(
      'Usage: tsx --import ./scripts/load-root-env.ts ./scripts/sync-r2-public-music-folder.ts [--dry-run] [--yes] <folder-with-mp3s>',
    );
    process.exit(1);
  }

  const resolvedFolder = path.resolve(folder);
  let stat;
  try {
    stat = statSync(resolvedFolder);
  } catch {
    console.error(`❌ Not a directory or not found: ${resolvedFolder}`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    console.error(`❌ Not a directory: ${resolvedFolder}`);
    process.exit(1);
  }

  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`❌ Missing env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
  } = process.env as Record<(typeof required)[number], string>;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const existing = await listAllObjectKeys(client, R2_BUCKET_NAME, PUBLIC_MUSIC_PREFIX);

  console.log(`Found ${existing.length} object(s) under ${PUBLIC_MUSIC_PREFIX}`);

  const ok = await confirmOrProceed(dryRun, yes, existing.length);
  if (!ok) {
    console.error('Aborted.');
    process.exit(1);
  }

  if (existing.length > 0) {
    await deleteKeysBatch(client, R2_BUCKET_NAME, existing, dryRun);
    console.log(dryRun ? '[dry-run] skipped delete' : `Deleted ${existing.length} object(s).`);
  }

  const names = readdirSync(resolvedFolder).filter((n) => /\.mp3$/i.test(n));
  if (names.length === 0) {
    console.error(`❌ No .mp3 files in ${resolvedFolder}`);
    process.exit(1);
  }

  names.sort((a, b) => a.localeCompare(b));
  const base = R2_PUBLIC_URL.replace(/\/+$/, '');
  const usedBasenames = new Set<string>();
  let uploaded = 0;

  for (const name of names) {
    const localPath = path.join(resolvedFolder, name);
    if (!statSync(localPath).isFile()) continue;

    const tail = uniqueKeyForUpload(sanitizeBasenameForKey(name), usedBasenames);
    const key = `${PUBLIC_MUSIC_PREFIX}${tail}`;

    if (dryRun) {
      console.log(`[dry-run] would upload ${localPath} → ${key}`);
      uploaded += 1;
      continue;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: createReadStream(localPath),
        ContentType: contentTypeForKey(key),
        CacheControl: 'public, max-age=86400',
      }),
    );
    console.log(`→ ${key}`);
    console.log(`   ${base}/${key}`);
    uploaded += 1;
  }

  console.log(`\n✅ ${dryRun ? '[dry-run] would upload' : 'Uploaded'} ${uploaded} file(s).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(2);
});
