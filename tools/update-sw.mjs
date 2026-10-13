// Riscrive in sw.js l'elenco dei file e la versione della cache.
// Va eseguito ogni volta che cambia un file dell'app (npm run sw): serve a far accorgere
// il telefono che c'è una versione nuova. I test falliscono se ci si dimentica.

import { readFileSync, writeFileSync } from 'node:fs';
import { computePrecache, swPath } from './precache.mjs';

const { files, version } = computePrecache();
const block = [
  '// <precache> (generato da tools/update-sw.mjs: non modificare a mano)',
  `const CACHE_VERSION = '${version}';`,
  `const PRECACHE = ${JSON.stringify(files, null, 2)};`,
  '// </precache>',
].join('\n');

const src = readFileSync(swPath, 'utf8');
const next = src.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
if (next === src) {
  console.log('sw.js già aggiornato (versione ' + version + ')');
} else {
  writeFileSync(swPath, next);
  console.log(`sw.js aggiornato: versione ${version}, ${files.length} file`);
}
