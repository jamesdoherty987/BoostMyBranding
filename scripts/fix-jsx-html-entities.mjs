/**
 * One-off / repeatable: replace literal HTML entity text in TS/TSX with real characters.
 * Entities in JSX *string literals* render literally (e.g. Couldn&apos;t); in text nodes
 * we still normalize for consistency.
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = [
  path.join('apps', 'web'),
  path.join('packages', 'ui', 'src', 'site'),
  path.join('packages', 'ui', 'src', 'aceternity'),
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p);
  }
}

const files = [];
for (const r of roots) walk(r, files);

const pairs = [
  ['&apos;', "'"],
  ['&quot;', '"'],
  ['&ldquo;', '\u201c'],
  ['&rdquo;', '\u201d'],
  ['&amp;', '&'],
  ['&gt;', '>'],
];

let changed = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [from, to] of pairs) {
    if (s.includes(from)) s = s.split(from).join(to);
  }
  if (s !== orig) {
    fs.writeFileSync(f, s);
    changed++;
    console.log(f);
  }
}
console.log(`Updated ${changed} files.`);
