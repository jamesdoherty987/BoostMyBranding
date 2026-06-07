/**
 * `next build` writes a production `.next` tree. Running `next dev` on top of it
 * leaves the browser requesting dev-only chunks (e.g. `main-app.js`, `app-pages-internals.js`)
 * that are not emitted in that folder → 404 and “tabs won’t load”.
 *
 * A clean dev tree does not include `required-server-files.json` (present after `next build`).
 * Remove `.next` when that marker exists so `next dev` always compiles a dev cache.
 *
 * For stale HMR / odd chunk hashes after many edits, use `pnpm dev:clean` instead.
 */
import fs from 'node:fs';
import path from 'node:path';

const nextDir = path.join(process.cwd(), '.next');
const prodMarker = path.join(nextDir, 'required-server-files.json');

if (fs.existsSync(prodMarker)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.info(
    '[web] Removed `.next` from a prior `next build` so `next dev` can compile. Hard-refresh the browser (Ctrl+Shift+R) if you still see 404s on `/_next/static/…`.',
  );
}
