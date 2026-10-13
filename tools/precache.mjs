// Elenca i file dell'app da mettere in cache e calcola la "versione" della cache.
// Usato da update-sw.mjs (che scrive sw.js) e dai test (che controllano che sw.js sia aggiornato).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const FILES = ['index.html', 'manifest.webmanifest'];
const DIRS = [
  ['css', /\.css$/],
  ['js', /\.js$/],
  ['fonts', /\.woff2$/],
  ['icons', /\.png$/],
];

function walk(dir, pattern, out) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, pattern, out);
    else if (pattern.test(name)) out.push(rel);
  }
}

export function computePrecache() {
  const files = [...FILES];
  for (const [dir, pattern] of DIRS) walk(dir, pattern, files);
  files.sort();
  const hash = createHash('sha256');
  for (const f of files) {
    let data = readFileSync(join(ROOT, f));
    // i fine riga non devono cambiare la versione (Windows/Linux)
    if (/\.(html|css|js|webmanifest)$/.test(f)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
    hash.update(f).update('\0').update(data).update('\0');
  }
  return { files, version: hash.digest('hex').slice(0, 12) };
}

export const swPath = join(ROOT, 'sw.js');
