import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { put } from '../js/db.js';
import { DEFAULT_SETTINGS, FONT_SIZES, LINE_SPACINGS, checkSettings, getSettings, saveSettings } from '../js/settings.js';
import { validateImport } from '../js/backup.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('interlinea: predefinita «normale», si salva e si controlla', async () => {
  assert.equal(DEFAULT_SETTINGS.lineSpacing, 'm');
  const db = await freshDb();
  assert.equal((await getSettings(db)).lineSpacing, 'm');
  await saveSettings(db, { lineSpacing: 'xl' });
  assert.equal((await getSettings(db)).lineSpacing, 'xl');
  await assert.rejects(saveSettings(db, { lineSpacing: 'enorme' }));
  assert.ok(checkSettings({ lineSpacing: 'boh' }).length > 0);
  db.close();
});

test('un record di impostazioni di una versione precedente (senza interlinea) prende il valore normale', async () => {
  const db = await freshDb();
  await put(db, 'settings', { id: 'main', theme: 'scuro', fontSize: 'l' });
  const s = await getSettings(db);
  assert.equal(s.lineSpacing, 'm');
  assert.equal(s.fontSize, 'l');
  db.close();
});

test('un backup di una versione precedente (senza interlinea) si importa senza errori', () => {
  const file = {
    app: 'diario-stoico',
    schemaVersion: 1,
    data: { settings: [{ id: 'main', theme: 'carta', font: 'serif', fontSize: 'm', lockEnabled: false, pinHash: null }] },
  };
  assert.ok(validateImport(file).ok);
});

test('boot.js (che applica l\'aspetto prima del primo disegno) accetta gli stessi valori delle impostazioni', () => {
  const boot = read('js/boot.js');
  const accepted = (key) => JSON.parse(new RegExp(`\\[([^\\]]*)\\]\\.indexOf\\(a\\.${key}\\)`).exec(boot)[1].replaceAll("'", '"').replace(/^/, '[').concat(']'));
  assert.deepEqual(accepted('fontSize'), FONT_SIZES);
  assert.deepEqual(accepted('lineSpacing'), LINE_SPACINGS);
});

test('ogni livello di interlinea ha la sua regola nel CSS', () => {
  const css = read('css/theme.css');
  for (const level of LINE_SPACINGS) assert.ok(css.includes(`data-spacing='${level}'`), level);
});
