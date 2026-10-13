import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/util.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('la versione ha la forma "numero.numero"', () => {
  assert.match(APP_VERSION, /^\d+\.\d+$/);
});

test('package.json ha la stessa versione (es. 1.2 → 1.2.0)', () => {
  assert.equal(JSON.parse(read('package.json')).version, `${APP_VERSION}.0`);
});

test('il CHANGELOG descrive la versione corrente', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${APP_VERSION.replace('.', '\\.')} — `, 'm'));
});
