/** Full `.next` wipe — use when dev HMR references missing chunks (404 on `/_next/static/…`). */
import fs from 'node:fs';
import path from 'node:path';

const nextDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.info('[web] Deleted `.next` (clean slate for next dev).');
}
