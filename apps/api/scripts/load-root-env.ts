/**
 * Preload hook for tsx: `tsx --import ./scripts/load-root-env.ts …`
 * Loads monorepo **root** `.env` before other modules read `process.env`
 * (fixes PERSONAL_TITLE_TEST_* when running from `apps/api`).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `apps/api/scripts` → monorepo root */
const repoRoot = path.resolve(here, '..', '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });
