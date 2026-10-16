import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { openDb, get, getAll, put } from '../js/db.js';
import { MIGRATIONS, SCHEMA_VERSION, STORES } from '../js/migrations.js';
import { createEntry, defaultLabel, deleteEntry, listEntriesForDay, updateEntry } from '../js/entries.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../js/settings.js';

test('database nuovo: tutti gli store previsti e versione = schemaVersion', async () => {
  const db = await freshDb();
  assert.equal(db.version, SCHEMA_VERSION);
  assert.deepEqual([...db.objectStoreNames].sort(), Object.keys(STORES).sort());
  db.close();
});

test('una migrazione futura conserva i dati esistenti', async () => {
  const name = `migrazione-${Date.now()}`;
  const v1 = await openDb(name);
  const entry = await createEntry(v1, { date: '2026-10-13', time: '09:00', content: 'prima' });
  await saveSettings(v1, { theme: 'scuro' });
  v1.close();

  const v2 = {
    version: 2,
    up(db, tx) {
      db.createObjectStore('tags', { keyPath: 'id' });
      // le migrazioni possono anche trasformare i dati esistenti
      tx.objectStore('entries').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        cursor.update({ ...cursor.value, nota: 'migrata' });
        cursor.continue();
      };
    },
  };
  const db2 = await openDb(name, [...MIGRATIONS, v2]);
  assert.equal(db2.version, 2);
  assert.ok(db2.objectStoreNames.contains('tags'));
  const kept = await get(db2, 'entries', entry.id);
  assert.equal(kept.content, 'prima');
  assert.equal(kept.nota, 'migrata');
  assert.equal((await getSettings(db2)).theme, 'scuro');
  db2.close();
});

test('una migrazione che fallisce non tocca i dati', async () => {
  const name = `migrazione-rotta-${Date.now()}`;
  const v1 = await openDb(name);
  const entry = await createEntry(v1, { date: '2026-10-13', time: '09:00', content: 'intatta' });
  v1.close();

  const broken = {
    version: 2,
    up(db) {
      db.createObjectStore('tags', { keyPath: 'id' });
      throw new Error('errore voluto');
    },
  };
  await assert.rejects(openDb(name, [...MIGRATIONS, broken]));

  const again = await openDb(name);
  assert.equal(again.version, 1);
  assert.equal((await get(again, 'entries', entry.id)).content, 'intatta');
  again.close();
});

test('createEntry: campi, id UUID, createdAt = updatedAt', async () => {
  const db = await freshDb();
  const e = await createEntry(db, { date: '2026-10-13', time: '09:41' });
  assert.match(e.id, /^[0-9a-f-]{36}$/);
  assert.equal(e.label, null);
  assert.equal(e.content, '');
  assert.equal(e.createdAt, e.updatedAt);
  assert.deepEqual(await get(db, 'entries', e.id), e);
  db.close();
});

test('createEntry rifiuta dati non validi', async () => {
  const db = await freshDb();
  await assert.rejects(createEntry(db, { date: '2026-02-30', time: '09:00' }));
  await assert.rejects(createEntry(db, { date: '2026-10-13', time: '9:00' }));
  await assert.rejects(createEntry(db, { date: '2026-10-13', time: '09:00', label: 'notte' }));
  assert.equal((await getAll(db, 'entries')).length, 0);
  db.close();
});

test('più voci per giorno, in ordine di ora; altri giorni esclusi', async () => {
  const db = await freshDb();
  await createEntry(db, { date: '2026-10-13', time: '21:30', content: 'sera' });
  await createEntry(db, { date: '2026-10-13', time: '07:15', content: 'mattina' });
  await createEntry(db, { date: '2026-10-14', time: '08:00', content: 'domani' });
  const day = await listEntriesForDay(db, '2026-10-13');
  assert.deepEqual(day.map((e) => e.content), ['mattina', 'sera']);
  assert.equal((await listEntriesForDay(db, '2026-10-15')).length, 0);
  db.close();
});

test('le voci seguono mattina, giorno, sera; senza etichetta contano in base all\'ora', async () => {
  const db = await freshDb();
  await createEntry(db, { date: '2026-10-13', time: '08:00', label: 'sera', content: 'sera scelta a mano' });
  await createEntry(db, { date: '2026-10-13', time: '21:00', content: 'senza etichetta, di sera' });
  await createEntry(db, { date: '2026-10-13', time: '13:00', label: 'giorno', content: 'giorno' });
  await createEntry(db, { date: '2026-10-13', time: '23:00', label: 'mattina', content: 'mattina scelta a mano' });
  const day = await listEntriesForDay(db, '2026-10-13');
  assert.deepEqual(day.map((e) => e.content), ['mattina scelta a mano', 'giorno', 'sera scelta a mano', 'senza etichetta, di sera']);
  db.close();
});

test('parte del giorno suggerita dall\'ora', () => {
  assert.equal(defaultLabel('00:00'), 'mattina');
  assert.equal(defaultLabel('11:59'), 'mattina');
  assert.equal(defaultLabel('12:00'), 'giorno');
  assert.equal(defaultLabel('17:59'), 'giorno');
  assert.equal(defaultLabel('18:00'), 'sera');
  assert.equal(defaultLabel('23:59'), 'sera');
});

test('updateEntry cambia contenuto ed etichetta, aggiorna updatedAt, mantiene createdAt', async () => {
  const db = await freshDb();
  const e = await createEntry(db, { date: '2026-10-13', time: '09:00' }, new Date('2026-10-13T07:00:00Z'));
  const u = await updateEntry(db, e.id, { content: '**ciao**', label: 'mattina' }, new Date('2026-10-13T08:00:00Z'));
  assert.equal(u.content, '**ciao**');
  assert.equal(u.label, 'mattina');
  assert.equal(u.createdAt, e.createdAt);
  assert.ok(u.updatedAt > e.updatedAt);
  const back = await updateEntry(db, e.id, { label: null });
  assert.equal(back.label, null);
  assert.equal(back.content, '**ciao**');
  await assert.rejects(updateEntry(db, 'non-esiste', { content: 'x' }));
  await assert.rejects(updateEntry(db, e.id, { label: 'notte' }));
  db.close();
});

test('più salvataggi ravvicinati: vince l\'ultimo', async () => {
  const db = await freshDb();
  const e = await createEntry(db, { date: '2026-10-13', time: '09:00' });
  await Promise.all(['a', 'ab', 'abc'].map((c) => updateEntry(db, e.id, { content: c })));
  assert.equal((await get(db, 'entries', e.id)).content, 'abc');
  db.close();
});

test('deleteEntry', async () => {
  const db = await freshDb();
  const a = await createEntry(db, { date: '2026-10-13', time: '09:00' });
  const b = await createEntry(db, { date: '2026-10-13', time: '10:00' });
  await deleteEntry(db, a.id);
  assert.deepEqual((await listEntriesForDay(db, '2026-10-13')).map((x) => x.id), [b.id]);
  db.close();
});

test('impostazioni: predefiniti, salvataggio parziale, validazione', async () => {
  const db = await freshDb();
  assert.deepEqual(await getSettings(db), DEFAULT_SETTINGS);
  await saveSettings(db, { font: 'sans' });
  await saveSettings(db, { fontSize: 'xl' });
  const s = await getSettings(db);
  assert.equal(s.font, 'sans');
  assert.equal(s.fontSize, 'xl');
  assert.equal(s.theme, 'carta');
  assert.equal(s.lockEnabled, false);
  await assert.rejects(saveSettings(db, { theme: 'fucsia' }));
  assert.equal((await getAll(db, 'settings')).length, 1);
  db.close();
});

test('un record salvato prima che esistesse un campo nuovo riceve il predefinito', async () => {
  const db = await freshDb();
  await put(db, 'settings', { id: 'main', theme: 'scuro' });
  const s = await getSettings(db);
  assert.equal(s.theme, 'scuro');
  assert.equal(s.fontSize, 'm');
  db.close();
});
