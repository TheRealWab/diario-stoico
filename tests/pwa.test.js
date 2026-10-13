import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { computePrecache, swPath } from '../tools/precache.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('sw.js è aggiornato: esegui "npm run sw" dopo aver modificato i file dell\'app', () => {
  const { files, version } = computePrecache();
  const sw = readFileSync(swPath, 'utf8');
  const v = /const CACHE_VERSION = '([^']+)'/.exec(sw)?.[1];
  const list = JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)[1]);
  assert.deepEqual(list, files, 'elenco dei file non aggiornato');
  assert.equal(v, version, 'versione della cache non aggiornata');
});

test('la cache comprende tutto ciò che serve per lavorare offline', () => {
  const { files } = computePrecache();
  for (const f of ['index.html', 'manifest.webmanifest', 'css/app.css', 'css/theme.css', 'js/app.js', 'js/boot.js',
    'fonts/lora-latin-wght-normal.woff2', 'fonts/lora-latin-wght-italic.woff2', 'fonts/inter-latin-wght-normal.woff2',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
    assert.ok(files.includes(f), `manca ${f}`);
  }
});

test('manifest completo, con percorsi relativi', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.lang, 'it');
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.theme_color && m.background_color);
  assert.ok(m.start_url.startsWith('.') && m.scope.startsWith('.'));
  const sizes = m.icons.map((i) => `${i.sizes}/${i.purpose}`);
  assert.ok(sizes.includes('192x192/any') && sizes.includes('512x512/any') && sizes.includes('512x512/maskable'));
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/'), 'percorso assoluto');
    assert.ok(existsSync(new URL(i.src, root)), `manca ${i.src}`);
  }
});

test('nessun percorso assoluto né risorsa esterna nei file dell\'app', () => {
  const { files } = computePrecache();
  for (const f of files.filter((x) => /\.(html|css|js|webmanifest)$/.test(x))) {
    const src = read(f);
    assert.ok(!/(src|href)=["']\//.test(src), `${f}: percorso assoluto`);
    assert.ok(!/url\(["']?\//.test(src), `${f}: url() assoluto`);
    assert.ok(!/(src|href)=["']https?:/.test(src), `${f}: risorsa esterna`);
    assert.ok(!/from ['"]\//.test(src), `${f}: import assoluto`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(src.replace(/\/\/.*$/gm, '')), `${f}: indirizzo esterno`);
  }
});

test('nessun innerHTML / insertAdjacentHTML / document.write nel codice', () => {
  const { files } = computePrecache();
  for (const f of files.filter((x) => x.startsWith('js/'))) {
    const code = read(f).replace(/\/\/.*$/gm, '');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(code), `${f}: uso non sicuro`);
  }
});
