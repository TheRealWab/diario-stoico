import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { createEntry, deleteEntry, isEmptyEntry, listEntriesForDay, restoreEntry } from '../js/entries.js';
import { dayPreview, firstWrittenDate, listDays, monthDays, writtenLabel } from '../js/archive.js';
import { monthGrid } from '../js/calendar.js';
import { addMonths, daysInMonth, isValidMonthStr, monthLabel, monthOf, weekdayIndex } from '../js/dates.js';
import { createCustomDef, dataText, saveInstance } from '../js/modules.js';
import { findRanges, normalize, searchEntries, searchItems, snippet, tokenize } from '../js/search.js';

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
  assert.deepEqual([...aug], [['2026-08-03', { entries: 2, modules: 0 }], ['2026-08-31', { entries: 1, modules: 0 }]]);
  assert.equal((await monthDays(db, '2026-07')).size, 0);
  assert.deepEqual((await monthDays(db, '2026-09')).get('2026-09-01'), { entries: 1, modules: 0 });
  db.close();
});

test('una voce vuota non conta come scritta: niente puntino, niente cronologia', async () => {
  const db = await seeded();
  await createEntry(db, { date: '2026-08-10', time: '08:00' }); // «Nuova voce» toccato e lasciato lì
  await createEntry(db, { date: '2026-08-03', time: '12:00', content: '   ' });
  assert.ok(isEmptyEntry({ content: '' }) && isEmptyEntry({ content: ' \n ' }) && !isEmptyEntry({ content: 'una riga' }));
  const aug = await monthDays(db, '2026-08');
  assert.equal(aug.has('2026-08-10'), false);
  assert.deepEqual(aug.get('2026-08-03'), { entries: 2, modules: 0 });
  const { days } = await listDays(db);
  assert.ok(!days.some((d) => d.date === '2026-08-10'));
  assert.equal(days.find((d) => d.date === '2026-08-03').entries.length, 2);
  db.close();
});

test('un giorno con soli moduli compare nel calendario e nella cronologia, con la sua anteprima', async () => {
  const db = await seeded();
  await saveInstance(db, '2026-08-20', 'evening', 'evening', { answers: ['Ho curato la fretta', '', 'Nella pazienza'] });
  await saveInstance(db, '2026-08-20', 'mood', 'mood', { mood: 4 });
  await saveInstance(db, '2026-08-03', 'negvis', 'negvis', { imagine: 'la vista', appreciate: '' });
  const mine = await createCustomDef(db, { name: 'Gratitudine', type: 'text' });
  await saveInstance(db, '2026-08-21', mine.id, 'text', { text: 'Il caffè con Anna' });

  const aug = await monthDays(db, '2026-08');
  assert.deepEqual(aug.get('2026-08-20'), { entries: 0, modules: 2 });
  assert.deepEqual(aug.get('2026-08-03'), { entries: 2, modules: 1 });
  assert.deepEqual(aug.get('2026-08-21'), { entries: 0, modules: 1 });

  const { days } = await listDays(db);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-13', '2026-09-01', '2026-08-31', '2026-08-21', '2026-08-20', '2026-08-03']);
  const day20 = days.find((d) => d.date === '2026-08-20');
  assert.deepEqual(day20.modules.map((m) => m.def.id), ['mood', 'evening']); // nell'ordine dei moduli
  assert.equal(dayPreview(day20.entries, 150, day20.modules), 'Umore ed energia · Esame serale: Ho curato la fretta; Nella pazienza');
  assert.equal(dayPreview([], 150, days.find((d) => d.date === '2026-08-21').modules), 'Gratitudine: Il caffè con Anna');
  // a pagine, come prima: un giorno di soli moduli sta al suo posto tra gli altri
  const p2 = await listDays(db, { before: '2026-08-31', limit: 2 });
  assert.deepEqual(p2.days.map((d) => d.date), ['2026-08-21', '2026-08-20']);
  assert.equal(p2.hasMore, true);
  db.close();
});

test('writtenLabel: quanto c’è di scritto, a parole', () => {
  assert.equal(writtenLabel({ entries: 1, modules: 0 }), '1 voce');
  assert.equal(writtenLabel({ entries: 3, modules: 1 }), '3 voci · 1 modulo');
  assert.equal(writtenLabel({ entries: 0, modules: 2 }, ', '), '2 moduli');
});

test('firstWrittenDate: il primo giorno scritto, tra voci e moduli', async () => {
  const empty = await freshDb();
  assert.equal(await firstWrittenDate(empty), null);
  empty.close();
  const db = await seeded();
  assert.equal(await firstWrittenDate(db), '2026-08-03');
  await saveInstance(db, '2026-07-15', 'negvis', 'negvis', { imagine: 'la casa', appreciate: '' });
  assert.equal(await firstWrittenDate(db), '2026-07-15');
  db.close();
});

test('una voce eliminata si può rimettere identica (Annulla)', async () => {
  const db = await freshDb();
  const entry = await createEntry(db, { date: '2026-10-13', time: '07:30', label: 'mattina', content: 'Da tenere' });
  await deleteEntry(db, entry.id);
  assert.equal((await listEntriesForDay(db, '2026-10-13')).length, 0);
  await restoreEntry(db, entry);
  assert.deepEqual(await listEntriesForDay(db, '2026-10-13'), [entry]);
  db.close();
});

test('dataText: le parole scritte in un modulo, niente per le scelte a tocco', () => {
  assert.equal(dataText('premeditatio', { cases: [{ event: 'Piove', response: 'Esco lo stesso' }, { event: '', response: '' }] }), 'Piove\nEsco lo stesso');
  assert.equal(dataText('evening', { answers: ['uno', '', 'tre'] }), 'uno\ntre');
  assert.equal(dataText('checklist', { items: [{ text: 'acqua', done: true }] }), 'acqua');
  assert.equal(dataText('virtues', { exercised: ['wisdom'], note: ' pazienza ' }), 'pazienza');
  assert.equal(dataText('mood', { mood: 3, energy: 2 }), '');
  assert.equal(dataText('rating', { value: 4 }), '');
});

test('searchItems: cerca in qualunque testo (voci, moduli, obiettivi), dal più recente', () => {
  const items = [
    { id: 'voce', text: 'Oggi ho avuto pazienza', date: '2026-10-10', time: '08:00' },
    { id: 'modulo', text: 'La pazienza con mio padre', date: '2026-10-12', time: '' },
    { id: 'obiettivo', text: 'Camminare ogni giorno\ncon pazienza', date: '2026-10-12', time: '' },
    { id: 'altro', text: 'Niente da dire', date: '2026-10-13', time: '09:00' },
  ];
  const r = searchItems(items, 'PAZIENZA');
  assert.equal(r.total, 3);
  assert.deepEqual(r.results.map((x) => x.item.id).sort(), ['modulo', 'obiettivo', 'voce']);
  assert.equal(r.results.at(-1).item.id, 'voce'); // la più vecchia in fondo
  assert.ok(r.results[0].parts.some((p) => p.match));
  assert.equal(searchItems(items, 'p').total, 0);
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
