import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { getAll, put } from '../js/db.js';
import {
  postponeGoal, checkGoal, checkGoalTree, closeGoal, countByStatus, createGoal, deleteGoal, getGoal, listChildren,
  listForDayStrip, listGoalsForPeriod, listParentCandidates, listPendingClosure, toggleDone, updateGoal,
} from '../js/goals.js';
import { buildExport, importData, validateImport } from '../js/backup.js';
import { STORES } from '../js/migrations.js';

const NOW = new Date('2026-10-13T10:00:00Z');
// ogni obiettivo nasce un millisecondo dopo il precedente, come nell'uso reale (l'ordine di creazione conta negli elenchi)
let tick = 0;
const make = (db, over) => createGoal(db, { title: 'Obiettivo', horizon: 'giorno', date: '2026-10-13', ...over }, new Date(NOW.getTime() + ++tick));

test('createGoal: periodo calcolato, titolo ripulito, stato iniziale', async () => {
  const db = await freshDb();
  const g = await make(db, { title: '  Camminare   ogni   giorno ', horizon: 'settimana', date: '2026-10-15', note: ' con calma ' });
  assert.equal(g.title, 'Camminare ogni giorno');
  assert.equal(g.start, '2026-10-12');
  assert.equal(g.end, '2026-10-18');
  assert.equal(g.status, 'da_fare');
  assert.equal(g.parentId, null);
  assert.equal(g.closure, null);
  assert.equal(g.note, 'con calma');
  assert.equal(g.createdAt, g.updatedAt);
  assert.match(g.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(checkGoal(g), []);
  db.close();
});

test('createGoal rifiuta dati non validi', async () => {
  const db = await freshDb();
  await assert.rejects(make(db, { title: '   ' }));
  await assert.rejects(make(db, { title: 'x'.repeat(201) }));
  await assert.rejects(make(db, { horizon: 'secolo' }));
  await assert.rejects(make(db, { date: '2026-02-30' }));
  assert.equal((await getAll(db, 'goals')).length, 0);
  db.close();
});

test('cascata: il genitore deve essere più lungo e contenere l\'inizio', async () => {
  const db = await freshDb();
  const october = await make(db, { title: 'Ottobre', horizon: 'mese', date: '2026-10-05' });
  const week = await make(db, { title: 'Settimana', horizon: 'settimana', date: '2026-10-13', parentId: october.id });
  assert.equal(week.parentId, october.id);
  await make(db, { title: 'Giorno sotto il mese', date: '2026-10-13', parentId: october.id }); // si salta un livello
  // la settimana 28 set – 4 ott comincia a settembre: non può stare sotto ottobre
  await assert.rejects(make(db, { horizon: 'settimana', date: '2026-10-01', parentId: october.id }));
  // stesso orizzonte e genitore inesistente
  await assert.rejects(make(db, { horizon: 'mese', date: '2026-10-05', parentId: october.id }));
  await assert.rejects(make(db, { parentId: 'non-esiste' }));
  db.close();
});

test('updateGoal: titolo, nota, stato, genitore; periodo e orizzonte non cambiano', async () => {
  const db = await freshDb();
  const month = await make(db, { title: 'Mese', horizon: 'mese', date: '2026-10-05' });
  const g = await make(db, { title: 'Settimana', horizon: 'settimana', date: '2026-10-13' });
  const u = await updateGoal(db, g.id, { title: ' Nuovo titolo ', note: 'una nota', status: 'rimandato', parentId: month.id }, new Date('2026-10-14T10:00:00Z'));
  assert.equal(u.title, 'Nuovo titolo');
  assert.equal(u.note, 'una nota');
  assert.equal(u.status, 'rimandato');
  assert.equal(u.parentId, month.id);
  assert.equal(u.createdAt, g.createdAt);
  assert.ok(u.updatedAt > g.updatedAt);
  assert.equal(u.horizon, 'settimana');
  assert.equal(u.start, '2026-10-12');
  const detached = await updateGoal(db, g.id, { parentId: null });
  assert.equal(detached.parentId, null);
  await assert.rejects(updateGoal(db, g.id, { title: '  ' }));
  await assert.rejects(updateGoal(db, g.id, { status: 'boh' }));
  await assert.rejects(updateGoal(db, g.id, { parentId: g.id })); // sé stesso: stesso orizzonte
  await assert.rejects(updateGoal(db, 'non-esiste', { title: 'x' }));
  db.close();
});

test('la spunta alterna da fare ↔ fatto', async () => {
  const db = await freshDb();
  const g = await make(db);
  assert.equal((await toggleDone(db, g.id)).status, 'fatto');
  assert.equal((await toggleDone(db, g.id)).status, 'da_fare');
  await updateGoal(db, g.id, { status: 'non_riuscito' });
  assert.equal((await toggleDone(db, g.id)).status, 'fatto'); // da qualunque altro stato si passa a «fatto»
  db.close();
});

test('chiusura guidata: lo stato diventa l\'esito, la riflessione è facoltativa e si ripulisce', async () => {
  const db = await freshDb();
  const g = await make(db, { horizon: 'settimana', date: '2026-10-05' });
  const { goal, moved } = await closeGoal(db, g.id, { outcome: 'non_riuscito', reflection: '  Troppo ambizioso.  ' }, new Date('2026-10-13T10:00:00Z'));
  assert.equal(goal.status, 'non_riuscito');
  assert.deepEqual(goal.closure, { outcome: 'non_riuscito', reflection: 'Troppo ambizioso.', date: '2026-10-13' });
  assert.equal(moved, false);
  const noText = await closeGoal(db, (await make(db)).id, { outcome: 'fatto' }, NOW);
  assert.equal(noText.goal.closure.reflection, ''); // nessun campo obbligatorio
  await assert.rejects(closeGoal(db, g.id, { outcome: 'da_fare' }));
  await assert.rejects(closeGoal(db, 'non-esiste', { outcome: 'fatto' }));
  db.close();
});

test('cambiare stato dopo la chiusura non cancella la riflessione', async () => {
  const db = await freshDb();
  const g = await make(db);
  await closeGoal(db, g.id, { outcome: 'fatto', reflection: 'Bene così.' }, NOW);
  const reopened = await toggleDone(db, g.id);
  assert.equal(reopened.status, 'da_fare');
  assert.equal(reopened.closure.reflection, 'Bene così.');
  assert.equal(reopened.closure.outcome, 'fatto'); // l'esito di allora resta com'era
  db.close();
});

test('rimandare: l\'obiettivo SI SPOSTA al periodo successivo e sparisce da quello di prima', async () => {
  const db = await freshDb();
  const day = await make(db, { title: 'Telefonare', date: '2026-10-13', note: 'a Marco' });
  await toggleDone(db, day.id); // anche se era «fatto», rimandarlo lo rimette da fare
  const { goal, detached } = await postponeGoal(db, day.id, {}, NOW);
  assert.equal(detached, 0);
  assert.equal(goal.id, day.id); // lo stesso obiettivo, non una copia
  assert.equal(goal.start, '2026-10-14');
  assert.equal(goal.end, '2026-10-14');
  assert.equal(goal.status, 'da_fare');
  assert.equal(goal.note, 'a Marco');
  assert.deepEqual(checkGoal(await getGoal(db, day.id)), []);
  assert.equal((await listGoalsForPeriod(db, 'giorno', '2026-10-13')).length, 0); // sparito dal giorno di prima
  assert.deepEqual((await listGoalsForPeriod(db, 'giorno', '2026-10-14')).map((g) => g.title), ['Telefonare']);
  assert.equal((await getAll(db, 'goals')).length, 1); // nessun doppione
  assert.equal((await listForDayStrip(db, '2026-10-14')).day.length, 1);
  await assert.rejects(postponeGoal(db, 'non-esiste', {}, NOW));
  db.close();
});

test('«rimandato» nella chiusura guidata: sposta l\'obiettivo e ricorda com\'è andata', async () => {
  const db = await freshDb();
  const october = await make(db, { title: 'Ottobre', horizon: 'mese', date: '2026-10-05' });
  const g = await make(db, { title: 'Leggere', horizon: 'settimana', date: '2026-10-13', parentId: october.id });
  const { goal, moved } = await closeGoal(db, g.id, { outcome: 'rimandato', reflection: 'Settimana piena.' }, NOW);
  assert.equal(moved, true);
  assert.equal(goal.start, '2026-10-19');
  assert.equal(goal.status, 'da_fare');
  assert.deepEqual(goal.closure, { outcome: 'rimandato', reflection: 'Settimana piena.', date: '2026-10-13' });
  assert.equal(goal.parentId, october.id); // il mese contiene anche la settimana dopo
  assert.equal((await listGoalsForPeriod(db, 'settimana', '2026-10-12')).length, 0);
  assert.equal((await getAll(db, 'goals')).length, 2); // mese + la settimana spostata
  const justDone = await closeGoal(db, (await make(db)).id, { outcome: 'fatto' }, NOW);
  assert.equal(justDone.moved, false); // lo spostamento vale solo per «rimandato»
  assert.equal(justDone.goal.status, 'fatto');
  db.close();
});

test('rimandare: il genitore si perde se non contiene il nuovo periodo; i sotto-obiettivi restano liberi', async () => {
  const db = await freshDb();
  const october = await make(db, { title: 'Ottobre', horizon: 'mese', date: '2026-10-05' });
  const lastWeek = await make(db, { horizon: 'settimana', date: '2026-10-26', parentId: october.id });
  const child = await make(db, { title: 'Martedì', date: '2026-10-27', parentId: lastWeek.id });
  const { goal, detached } = await postponeGoal(db, lastWeek.id, {}, NOW); // 2 novembre: fuori da ottobre
  assert.equal(goal.start, '2026-11-02');
  assert.equal(goal.parentId, null);
  assert.equal(detached, 1);
  const kept = await getGoal(db, child.id);
  assert.equal(kept.parentId, null); // resta dov'era (27 ottobre), ma senza genitore
  assert.equal(kept.start, '2026-10-27');
  // tutto resta coerente: l'albero passa i controlli del backup
  const all = await getAll(db, 'goals');
  assert.deepEqual(checkGoalTree(all), []);
  for (const g of all) assert.deepEqual(checkGoal(g), []);
  db.close();
});

test('eliminare: i sotto-obiettivi restano, senza genitore; i collegamenti vanno via', async () => {
  const db = await freshDb();
  const month = await make(db, { title: 'Mese', horizon: 'mese', date: '2026-10-05' });
  const a = await make(db, { title: 'A', horizon: 'settimana', date: '2026-10-13', parentId: month.id });
  const b = await make(db, { title: 'B', date: '2026-10-14', parentId: month.id });
  const other = await make(db, { title: 'Altro' });
  await put(db, 'goalLinks', { id: 'l1', goalId: month.id, entryId: 'e1' });
  await put(db, 'goalLinks', { id: 'l2', goalId: other.id, entryId: 'e1' });
  assert.equal(await deleteGoal(db, month.id, NOW), 2);
  assert.equal(await getGoal(db, month.id), undefined);
  assert.equal((await getGoal(db, a.id)).parentId, null);
  assert.equal((await getGoal(db, b.id)).parentId, null);
  assert.equal((await getAll(db, 'goals')).length, 3);
  assert.deepEqual((await getAll(db, 'goalLinks')).map((l) => l.id), ['l2']);
  assert.equal(await deleteGoal(db, other.id, NOW), 0);
  db.close();
});

test('elenchi: per periodo, sotto-obiettivi, striscia del giorno, genitori possibili', async () => {
  const db = await freshDb();
  const month = await make(db, { title: 'Mese', horizon: 'mese', date: '2026-10-05' });
  const wk = await make(db, { title: 'Sett', horizon: 'settimana', date: '2026-10-13', parentId: month.id });
  const wkOther = await make(db, { title: 'Sett dopo', horizon: 'settimana', date: '2026-10-20' });
  const d1 = await make(db, { title: 'Oggi 1', parentId: wk.id });
  const d2 = await make(db, { title: 'Oggi 2' });
  await make(db, { title: 'Domani', date: '2026-10-14' });

  assert.deepEqual((await listGoalsForPeriod(db, 'giorno', '2026-10-13')).map((g) => g.title), ['Oggi 1', 'Oggi 2']);
  assert.deepEqual((await listGoalsForPeriod(db, 'settimana', '2026-10-12')).map((g) => g.id), [wk.id]);
  assert.deepEqual((await listGoalsForPeriod(db, 'mese', '2026-10-01')).map((g) => g.id), [month.id]);

  const strip = await listForDayStrip(db, '2026-10-15');
  assert.deepEqual(strip.day, []); // il 15 non ha obiettivi giornalieri
  assert.deepEqual(strip.week.map((g) => g.id), [wk.id]); // ma ha quelli della sua settimana
  const today = await listForDayStrip(db, '2026-10-13');
  assert.deepEqual(today.day.map((g) => g.id), [d1.id, d2.id]);

  await updateGoal(db, d2.id, { parentId: month.id });
  assert.deepEqual((await listChildren(db, month.id)).map((g) => g.title), ['Sett', 'Oggi 2']); // prima il più lungo

  const candidates = await listParentCandidates(db, 'giorno', '2026-10-13');
  assert.deepEqual(candidates.map((g) => g.title), ['Mese', 'Sett']);
  assert.ok(!candidates.some((g) => g.id === wkOther.id)); // un'altra settimana non contiene quel giorno
  assert.deepEqual(await listParentCandidates(db, 'anno', '2026-01-01'), []);
  db.close();
});

test('periodi conclusi da proporre: secondo la politica concordata', async () => {
  const db = await freshDb();
  const today = '2026-10-20';
  const pending = await make(db, { title: 'Settimana scorsa', horizon: 'settimana', date: '2026-10-13' });
  const month = await make(db, { title: 'Settembre', horizon: 'mese', date: '2026-09-10' });
  await make(db, { title: 'Ieri (giorno)', date: '2026-10-19' }); // i giorni non si propongono
  await make(db, { title: 'In corso', horizon: 'settimana', date: '2026-10-20' });
  await make(db, { title: 'Troppo vecchia', horizon: 'settimana', date: '2026-07-01' });
  const done = await make(db, { title: 'Già fatta', horizon: 'settimana', date: '2026-10-06' });
  await toggleDone(db, done.id);
  const postponed = await make(db, { title: 'Rimandata', horizon: 'settimana', date: '2026-10-06' });
  await updateGoal(db, postponed.id, { status: 'rimandato' });
  assert.deepEqual((await listPendingClosure(db, today)).map((g) => g.title), ['Settembre', 'Settimana scorsa']); // il più lungo per primo
  await closeGoal(db, pending.id, { outcome: 'fatto' }, new Date('2026-10-20T10:00:00Z'));
  await closeGoal(db, month.id, { outcome: 'rimandato' }, new Date('2026-10-20T10:00:00Z'));
  assert.deepEqual(await listPendingClosure(db, today), []);
  db.close();
});

test('riepilogo descrittivo: solo conteggi per stato', () => {
  assert.deepEqual(countByStatus([{ status: 'fatto' }, { status: 'fatto' }, { status: 'da_fare' }, { status: 'rimandato' }]), {
    da_fare: 1, fatto: 2, non_riuscito: 0, rimandato: 1,
  });
});

// ---------- controlli sui dati (anche per i backup) ----------

const good = () => ({
  id: 'a', title: 'T', horizon: 'settimana', start: '2026-10-12', end: '2026-10-18', status: 'da_fare',
  parentId: null, note: '', closure: null, createdAt: 'x', updatedAt: 'x',
});

test('checkGoal: accetta un obiettivo corretto e respinge quelli sbagliati', () => {
  assert.deepEqual(checkGoal(good()), []);
  const bad = {
    'senza titolo': { title: '  ' },
    'orizzonte': { horizon: 'secolo' },
    'periodo che non è una settimana': { start: '2026-10-13', end: '2026-10-19' },
    'fine sbagliata': { end: '2026-10-17' },
    'data non valida': { start: '2026-02-30' },
    'stato': { status: 'boh' },
    'genitore': { parentId: 5 },
    'sé stesso': { parentId: 'a' },
    'nota': { note: null },
    'chiusura': { closure: { outcome: 'da_fare', reflection: '', date: '2026-10-13' } },
    'chiusura senza data': { closure: { outcome: 'fatto', reflection: '' } },
    'senza date di sistema': { createdAt: undefined },
  };
  for (const [name, patch] of Object.entries(bad)) assert.ok(checkGoal({ ...good(), ...patch }).length > 0, name);
  assert.ok(checkGoal(null).length > 0);
  assert.deepEqual(checkGoal({ ...good(), closure: { outcome: 'fatto', reflection: '', date: '2026-10-19' } }), []);
});

test('checkGoalTree: genitori presenti e compatibili', () => {
  const month = { ...good(), id: 'm', horizon: 'mese', start: '2026-10-01', end: '2026-10-31' };
  const week = { ...good(), id: 'w', parentId: 'm' };
  assert.deepEqual(checkGoalTree([month, week]), []);
  assert.equal(checkGoalTree([week]).length, 1); // genitore mancante
  assert.equal(checkGoalTree([{ ...month, id: 'm2', start: '2026-11-01', end: '2026-11-30' }, { ...week, parentId: 'm2' }]).length, 1); // periodo non contenuto
});

// ---------- backup ----------

test('backup: gli obiettivi (con cascata e chiusure) tornano identici', async () => {
  const db = await freshDb();
  const month = await make(db, { title: 'Mese', horizon: 'mese', date: '2026-10-05' });
  const wk = await make(db, { title: 'Sett', horizon: 'settimana', date: '2026-10-13', parentId: month.id });
  await closeGoal(db, wk.id, { outcome: 'rimandato', reflection: 'Troppo da fare.' }, NOW);
  const file = JSON.parse(JSON.stringify(await buildExport(db)));
  assert.equal(file.data.goals.length, 2);
  const check = validateImport(file);
  assert.ok(check.ok, check.errors.join());

  const other = await freshDb();
  await importData(other, check.data, 'replace');
  const sort = (rows) => rows.sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(sort(await getAll(other, 'goals')), sort(await getAll(db, 'goals')));
  db.close();
  other.close();
});

test('backup: obiettivi non validi o con genitore mancante vengono respinti', async () => {
  const db = await freshDb();
  const month = await make(db, { title: 'Mese', horizon: 'mese', date: '2026-10-05' });
  await make(db, { title: 'Sett', horizon: 'settimana', date: '2026-10-13', parentId: month.id });
  const file = JSON.parse(JSON.stringify(await buildExport(db)));
  assert.ok(validateImport(file).ok);

  const wrongPeriod = structuredClone(file);
  wrongPeriod.data.goals[0].end = '2026-12-31';
  assert.equal(validateImport(wrongPeriod).ok, false);

  const missingParent = structuredClone(file);
  missingParent.data.goals = missingParent.data.goals.filter((g) => g.horizon !== 'mese');
  assert.equal(validateImport(missingParent).ok, false);

  const badStatus = structuredClone(file);
  badStatus.data.goals[0].status = 'fatto!';
  assert.equal(validateImport(badStatus).ok, false);
  assert.ok(Object.keys(STORES).includes('goals'));
  db.close();
});
