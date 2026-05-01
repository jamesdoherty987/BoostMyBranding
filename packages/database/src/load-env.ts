/**
 * Zero-dependency loader for the monorepo's root .env file.
 *
 * We intentionally avoid `dotenv` here so the migrate/seed CLIs keep working
 * even if node_modules is in a weird state. On Render/production there's no
 * .env at all — everything comes from the real process env, so this is a no-op.
 *
 * The .env format we support is the standard KEY=VALUE per line, with `#`
 * comments and optional surrounding quotes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadRepoRootEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = findRepoRoot(here);
  if (!root) return;
  for (const name of ['.env', '.env.example']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (!key || key in process.env) continue; // never override real env
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    break; // real .env wins over .env.example
  }
}

function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'turbo.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
