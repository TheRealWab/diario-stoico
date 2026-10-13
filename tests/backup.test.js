import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { getAll } from '../js/db.js';
import { STORES, SCHEMA_VERSION } from '../js/migrations.js';
import { createEntry } from '../js/entries.js';
import { getSettings, saveSettings } from '../js/settings.js';
import { buildExport, exportFilename, importData, planMerge, validateImport } from '../js/backup.js';

async function snapshot(db) {
  const out = {};
  for (const store of Object.keys(STORES)) {
    out[store] = (await getAll(db, store)).sort((a, b) => String(a.id ?? a.date).localeCompare(String(b.id ?? b.date)));
  }
  return out;
}

async function filled() {
  const db = await freshDb();
  await createEntry(db, { date: '2026-10-12', time: '08:00', label: 'mattina', content: '## Ieri\n\nUn **bel** giorno' });
  await createEntry(db, { date: '2026-10-13', time: '21:10', label: 'sera', content: '- uno\n- due' });
  await createEntry(db, { date: '2026-10-13', time: '07:00', content: 'àèéìòù “virgolette” — emoji 🌿' });
  await saveSettings(db, { theme: 'scuro', font: 'sans', fontSize: 'l' });
  return db;
}

const NOW = new Date('2026-10-13T12:00:00Z');

test('nome del file di export', () => {
  assert.equal(exportFilename(NOW), 'diario-stoico-2026-10-13.json');
});

test("l'export contiene app, versione, data e tutti i dati", async () => {
  const db = await filled();
  const file = await buildExport(db, NOW);
  assert.equal(file.app, 'diario-stoico');
  assert.equal(file.schemaVersion, SCHEMA_VERSION);
  assert.equal(file.exportedAt, '2026-10-13T12:00:00.000Z');
  assert.deepEqual(Object.keys(file.data).sort(), Object.keys(STORES).sort());
  assert.equal(file.data.entries.length, 3);
  assert.equal(file.data.settings[0].lastBackupDate, '2026-10-13');
  assert.equal((await getSettings(db)).lastBackupDate, '2026-10-13');
  db.close();
});

test('export, cancellazione totale, import "sostituisci": tutto torna identico', async () => {
  const db = await filled();
  const json = JSON.stringify(await buildExport(db, NOW)); // passa davvero da testo, come il file
  const before = await snapshot(db);

  await importData(db, validateImport(JSON.parse(json)).data, 'replace'); // sostituire con sé stesso
  assert.deepEqual(await snapshot(db), before);

  const empty = await freshDb();
  const check = validateImport(JSON.parse(json));
  assert.ok(check.ok, check.errors.join('\n'));
  await importData(empty, check.data, 'replace');
  assert.deepEqual(await snapshot(empty), before);
  db.close();
  empty.close();
});

test('"sostituisci" elimina ciò che non è nel file', async () => {
  const source = await filled();
  const file = JSON.parse(JSON.stringify(await buildExport(source, NOW)));
  const target = await freshDb();
  await createEntry(target, { date: '2026-01-01', time: '10:00', content: 'da eliminare' });
  await importData(target, validateImport(file).data, 'replace');
  const contents = (await getAll(target, 'entries')).map((e) => e.content);
  assert.equal(contents.length, 3);
  assert.ok(!contents.includes('da eliminare'));
  source.close();
  target.close();
});

test('"unisci": aggiunge il nuovo, vince il più recente, non tocca le impostazioni', async () => {
  const source = await filled();
  const file = JSON.parse(JSON.stringify(await buildExport(source, NOW)));
  const [first] = file.data.entries;

  const target = await freshDb();
  await saveSettings(target, { theme: 'carta', fontSize: 'xl' });
  // una voce già presente ma più vecchia del file, una più recente, una solo qui
  await importData(target, { entries: [{ ...first, content: 'vecchia', updatedAt: '2000-01-01T00:00:00.000Z' }] }, 'merge');
  const newer = file.data.entries[1];
  await importData(target, { entries: [{ ...newer, content: 'più recente qui', updatedAt: '2999-01-01T00:00:00.000Z' }] }, 'merge');
  const local = await createEntry(target, { date: '2026-05-05', time: '10:00', content: 'solo qui' });

  const data = validateImport(file).data;
  const plan = await planMerge(target, data);
  assert.deepEqual(plan, { added: 1, updated: 1, unchanged: 1 });

  const res = await importData(target, data, 'merge');
  assert.equal(res.added + res.updated >= 2, true);
  const byId = new Map((await getAll(target, 'entries')).map((e) => [e.id, e]));
  assert.equal(byId.size, 4);
  assert.equal(byId.get(first.id).content, first.content); // il file era più recente
  assert.equal(byId.get(newer.id).content, 'più recente qui'); // la copia locale era più recente
  assert.equal(byId.get(local.id).content, 'solo qui');
  const s = await getSettings(target);
  assert.equal(s.theme, 'carta'); // impostazioni locali intatte
  assert.equal(s.fontSize, 'xl');
  source.close();
  target.close();
});

const good = async () => JSON.parse(JSON.stringify(await buildExport(await filled(), NOW)));

test('validazione: file non validi vengono respinti con un messaggio', async () => {
  const cases = {
    'non è un oggetto': () => [1, 2],
    'altra app': (f) => ({ ...f, app: 'altra-cosa' }),
    'versione mancante': (f) => ({ ...f, schemaVersion: undefined }),
    'versione futura': (f) => ({ ...f, schemaVersion: SCHEMA_VERSION + 1 }),
    'dati mancanti': (f) => ({ ...f, data: undefined }),
    'sezione non array': (f) => ({ ...f, data: { ...f.data, entries: {} } }),
    'data non valida': (f) => ({ ...f, data: { ...f.data, entries: [{ ...f.data.entries[0], date: '2026-02-30' }] } }),
    'ora non valida': (f) => ({ ...f, data: { ...f.data, entries: [{ ...f.data.entries[0], time: '25:00' }] } }),
    'etichetta non valida': (f) => ({ ...f, data: { ...f.data, entries: [{ ...f.data.entries[0], label: 'notte' }] } }),
    'contenuto non testo': (f) => ({ ...f, data: { ...f.data, entries: [{ ...f.data.entries[0], content: 5 }] } }),
    'id duplicati': (f) => ({ ...f, data: { ...f.data, entries: [f.data.entries[0], f.data.entries[0]] } }),
    'impostazione non valida': (f) => ({ ...f, data: { ...f.data, settings: [{ ...f.data.settings[0], theme: 'x' }] } }),
  };
  const f = await good();
  for (const [name, mutate] of Object.entries(cases)) {
    const res = validateImport(mutate(structuredClone(f)));
    assert.equal(res.ok, false, name);
    assert.ok(res.errors.length > 0, name);
  }
  assert.ok(validateImport(f).ok);
});

test('un file valido ma vuoto si importa senza errori', () => {
  const res = validateImport({ app: 'diario-stoico', schemaVersion: 1, data: {} });
  assert.ok(res.ok);
  assert.equal(res.summary.entries.count, 0);
  assert.equal(res.summary.entries.from, null);
});

test('il riepilogo conta le voci e dà il periodo', async () => {
  const res = validateImport(await good());
  assert.equal(res.summary.entries.count, 3);
  assert.equal(res.summary.entries.from, '2026-10-12');
  assert.equal(res.summary.entries.to, '2026-10-13');
});

test('un import non valido non tocca i dati esistenti', async () => {
  const db = await filled();
  const before = await snapshot(db);
  const f = await good();
  f.data.entries[0].date = 'ieri';
  const res = validateImport(f);
  assert.equal(res.ok, false);
  assert.deepEqual(await snapshot(db), before); // nessuna scrittura è avvenuta
  db.close();
});

test('se la scrittura fallisce a metà, "sostituisci" annulla tutto', async () => {
  const db = await filled();
  const before = await snapshot(db);
  // record senza chiave: la put fallisce dentro la transazione
  await assert.rejects(importData(db, { entries: [{ date: '2026-10-13' }] }, 'replace'));
  assert.deepEqual(await snapshot(db), before);
  db.close();
});

test('un backup di una versione precedente passa dalle migrazioni dei dati', () => {
  const migrations = [
    { version: 1, up() {}, migrateData: (d) => d },
    { version: 2, up() {}, migrateData: (d) => ({ ...d, entries: d.entries.map((e) => ({ ...e, content: e.content.toUpperCase() })) }) },
  ];
  const file = {
    app: 'diario-stoico', schemaVersion: 1,
    data: { entries: [{ id: 'a', date: '2026-10-13', time: '09:00', label: null, content: 'ciao', createdAt: 'x', updatedAt: 'x' }] },
  };
  const res = validateImport(file, migrations);
  assert.ok(res.ok, res.errors.join());
  assert.equal(res.data.entries[0].content, 'CIAO');
});
