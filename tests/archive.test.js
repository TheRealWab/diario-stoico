import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { createEntry } from '../js/entries.js';
import { dayPreview, listDays, monthDays } from '../js/archive.js';
import { monthGrid } from '../js/calendar.js';
import { addMonths, daysInMonth, isValidMonthStr, monthLabel, monthOf, weekdayIndex } from '../js/dates.js';
import { findRanges, normalize, searchEntries, snippet, tokenize } from '../js/search.js';

// ---------- date e calendario ----------

test('weekdayIndex: la settimana parte da lunedì', () => {
  assert.equal(weekdayIndex('2026-10-12'), 0); // lunedì
  assert.equal(weekdayIndex('2026-10-13'), 1); // martedì
  assert.equal(weekdayIndex('2026-10-18'), 6); // domenica
});

test('mesi: lunghezza, somma, etichetta', () => {
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-10'), 31);
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', 14), '2027-12');
  assert.equal(monthLabel('2026-10'), 'ottobre 2026');
  assert.equal(monthOf('2026-10-13'), '2026-10');
  assert.ok(isValidMonthStr('2026-10') && !isValidMonthStr('2026-13') && !isValidMonthStr('2026-1'));
});

test('monthGrid: ottobre 2026 parte da lunedì 28 settembre', () => {
  const weeks = monthGrid('2026-10');
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0][0].date, '2026-09-28');
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][3].date, '2026-10-01'); // giovedì
  assert.equal(weeks[0][3].inMonth, true);
  assert.equal(weeks.at(-1).at(-1).date, '2026-11-01');
  assert.equal(weeks.flat().filter((c) => c.inMonth).length, 31);
});

test('monthGrid: casi limite (febbraio da 4 righe, mese da 6 righe, bisestile)', () => {
  assert.equal(monthGrid('2027-02').length, 4); // 1 febbraio 2027 è lunedì, 28 giorni
  assert.equal(monthGrid('2026-03').length, 6); // 1 marzo 2026 è domenica: 6 + 31 celle
  assert.equal(monthGrid('2026-11').length, 6); // 1 novembre 2026 è domenica: 6 + 30 celle
  assert.equal(monthGrid('2028-02').flat().filter((c) => c.inMonth).length, 29);
});

// ---------- dati dell'archivio ----------

async function seeded() {
  const db = await freshDb();
  const add = (date, time, content) => createEntry(db, { date, time, content });
  await add('2026-08-03', '09:00', 'Agosto uno');
  await add('2026-08-03', '21:00', 'Agosto sera');
  await add('2026-08-31', '10:00', 'Fine agosto');
  await add('2026-09-01', '10:00', 'Inizio settembre');
  await add('2026-10-13', '07:30', 'Oggi: **perché** no');
  return db;
}

test('monthDays conta le voci per giorno e non esce dal mese', async () => {
  const db = await seeded();
  const aug = await monthDays(db, '2026-08');
  assert.deepEqual([...aug], [['2026-08-03', 2], ['2026-08-31', 1]]);
  assert.equal((await monthDays(db, '2026-07')).size, 0);
  assert.equal((await monthDays(db, '2026-09')).get('2026-09-01'), 1);
  db.close();
});

test('listDays: dal più recente, a pagine, voci in ordine di ora', async () => {
  const db = await seeded();
  const p1 = await listDays(db, { limit: 2 });
  assert.deepEqual(p1.days.map((d) => d.date), ['2026-10-13', '2026-09-01']);
  assert.equal(p1.hasMore, true);
  const p2 = await listDays(db, { before: '2026-09-01', limit: 2 });
  assert.deepEqual(p2.days.map((d) => d.date), ['2026-08-31', '2026-08-03']);
  assert.deepEqual(p2.days[1].entries.map((e) => e.time), ['09:00', '21:00']);
  assert.equal(p2.hasMore, false);
  const all = await listDays(db, { limit: 30 });
  assert.equal(all.days.length, 4);
  assert.equal(all.hasMore, false);
  db.close();
});

test('listDays su un diario vuoto', async () => {
  const db = await freshDb();
  assert.deepEqual(await listDays(db), { days: [], hasMore: false });
  db.close();
});

test('dayPreview: testo semplice, voci unite, accorciato', () => {
  const e = (content) => ({ content });
  assert.equal(dayPreview([e('Ciao **mondo**'), e('- uno\n- due')]), 'Ciao mondo · uno due');
  assert.equal(dayPreview([e('')]), '');
  const long = dayPreview([e('parola '.repeat(60))], 50);
  assert.ok(long.endsWith('…') && long.length <= 52);
});

// ---------- ricerca ----------

test('normalize toglie accenti e maiuscole; tokenize divide le parole', () => {
  assert.equal(normalize('Perché è così'), 'perche e cosi');
  assert.deepEqual(tokenize('  Virtù  CORAGGIO '), ['virtu', 'coraggio']);
});

test('findRanges: posizioni nel testo originale, anche con accenti', () => {
  const text = 'Oggi, perché no? PERCHÉ sì.';
  const ranges = findRanges(text, tokenize('perche'));
  assert.deepEqual(ranges.map(([a, b]) => text.slice(a, b)), ['perché', 'PERCHÉ']);
});

test('searchEntries: tutte le parole, ignora accenti, dal più recente', () => {
  const mk = (id, date, time, content) => ({ id, date, time, content });
  const entries = [
    mk('a', '2026-08-03', '09:00', 'Il coraggio di ricominciare'),
    mk('b', '2026-10-13', '07:30', 'Oggi: **perché** il CORAGGIO conta'),
    mk('c', '2026-10-13', '21:00', 'Perché no, ma senza altro'),
    mk('d', '2026-09-01', '10:00', 'Niente'),
  ];
  const r = searchEntries(entries, 'perche coraggio');
  assert.deepEqual(r.results.map((x) => x.entry.id), ['b']);
  const r2 = searchEntries(entries, 'CORAGGIO');
  assert.deepEqual(r2.results.map((x) => x.entry.id), ['b', 'a']);
  assert.equal(r2.total, 2);
  assert.equal(searchEntries(entries, 'a').results.length, 0); // troppo corta
  assert.equal(searchEntries(entries, '').total, 0);
});

test('snippet: evidenzia le parole e accorcia con i puntini', () => {
  const text = 'Questa è una frase molto lunga che parla del coraggio di chi ricomincia ogni mattina senza lamentarsi di niente e di nessuno';
  const parts = snippet(text, tokenize('coraggio'), 20);
  assert.ok(parts.some((p) => p.match && p.text === 'coraggio'));
  assert.ok(parts[0].text.startsWith('…'));
  assert.ok(parts.at(-1).text.endsWith('…'));
  const joined = parts.map((p) => p.text).join('');
  assert.ok(joined.length < text.length);
});

test('snippet: parole di inizio testo, nessun puntino iniziale', () => {
  const parts = snippet('Coraggio e calma', tokenize('coraggio'));
  assert.deepEqual(parts, [{ text: 'Coraggio', match: true }, { text: ' e calma', match: false }]);
});

test('la ricerca non trova i simboli del Markdown', () => {
  const entries = [{ id: 'a', date: '2026-10-13', time: '07:30', content: '**grassetto** e *corsivo*' }];
  assert.equal(searchEntries(entries, '**').total, 0);
  assert.equal(searchEntries(entries, 'grassetto').total, 1);
});
