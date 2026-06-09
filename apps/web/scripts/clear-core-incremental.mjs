/**
 * Vercel / CI: if `packages/core/dist` was removed but `tsconfig.tsbuildinfo`
 * remains, `tsc` can exit 0 without emitting — downstream `tsc --noEmit` in
 * api-client then fails. Unlink the incremental file before building core.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tsbuildinfo = path.join(repoRoot, 'packages', 'core', 'tsconfig.tsbuildinfo');
try {
  fs.unlinkSync(tsbuildinfo);
} catch {
  /* absent or unreadable — fine */
}
