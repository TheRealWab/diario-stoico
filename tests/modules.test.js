import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { getAll } from '../js/db.js';
import {
  archiveCustomDef, arrangeForDay, checkDayRecord, checkModuleDef, checkModuleInstance, createCustomDef, defaultData, enabledIds,
  getDay, getInstance, hasContent, instanceId, isEmptyData, isVisible, listAllDefs, listCustomDefs, listInstancesForDay,
  normalizeData, saveInstance, setModuleEnabled, setVisibleForDay, updateCustomDef,
  ENTRIES_ID, defaultOrder, moveInOrder, orderDefs, resolveOrder, setModuleOrder,
} from '../js/modules.js';
import { BUILTIN_MODULES, CUSTOM_TYPES, EVENING_VARIANTS, LIMITS, TEMPLATES, VIRTUES } from '../js/modules-catalog.js';
import { checkSettings, getSettings } from '../js/settings.js';
import { buildExport, importData, validateImport } from '../js/backup.js';

const NOW = new Date('2026-10-19T10:00:00Z');
const DAY = '2026-10-19';

// ---------- catalogo ----------

test('catalogo: otto moduli già pronti con id unici, uno per tipo, e testi senza punteggi', () => {
  assert.deepEqual(
    BUILTIN_MODULES.map((m) => m.id),
    ['quote', 'goals', 'premeditatio', 'negvis', 'control', 'virtues', 'mood', 'evening'],
  );
  assert.equal(new Set(BUILTIN_MODULES.map((m) => m.id)).size, BUILTIN_MODULES.length);
  for (const m of BUILTIN_MODULES) {
    assert.ok(m.name && m.blurb && ['top', 'bottom'].includes(m.slot), m.id);
    assert.ok(!/punteggio|voto|serie di giorni/i.test(m.blurb), `${m.id}: tono descrittivo`);
  }
  assert.equal(VIRTUES.length, 4);
  assert.equal(EVENING_VARIANTS.length, 2);
  assert.ok(EVENING_VARIANTS.every((v) => v.questions.length === 3));
  assert.ok(TEMPLATES.every((t) => CUSTOM_TYPES.includes(t.type) && t.name && t.prompt));
});

// ---------- forma e contenuto dei dati ----------

test('normalizeData: porta qualunque cosa alla forma giusta e rispetta i limiti', () => {
  assert.deepEqual(defaultData('text'), { text: '' });
  assert.deepEqual(defaultData('rating'), { value: null });
  assert.deepEqual(defaultData('premeditatio'), { cases: [{ event: '', response: '' }] });
  assert.deepEqual(defaultData('mood'), { mood: null, energy: null });
  assert.deepEqual(defaultData('evening'), { variant: 'seneca', answers: ['', '', ''] });
  assert.deepEqual(defaultData('quote'), {});
  // dati rotti o di un altro tipo non fanno danni
  assert.deepEqual(normalizeData('text', null), { text: '' });
  assert.deepEqual(normalizeData('text', { text: 5 }), { text: '' });
  assert.deepEqual(normalizeData('rating', { value: 9 }), { value: null });
  assert.deepEqual(normalizeData('rating', { value: 3 }), { value: 3 });
  assert.deepEqual(normalizeData('mood', { mood: 2, energy: 'alta' }), { mood: 2, energy: null });
  assert.deepEqual(normalizeData('virtues', { exercised: ['coraggio', 'coraggio', 'pigrizia'], missed: 'x', note: 1 }), { exercised: ['coraggio'], missed: [], note: '' });
  assert.deepEqual(normalizeData('evening', { variant: 'boh', answers: ['a'] }), { variant: 'seneca', answers: ['a', '', ''] });
  // lunghezze
  assert.equal(normalizeData('text', { text: 'x'.repeat(LIMITS.text + 50) }).text.length, LIMITS.text);
  const items = Array.from({ length: LIMITS.itemsMax + 5 }, (_, i) => ({ text: `voce ${i}`, done: i % 2 === 0 }));
  assert.equal(normalizeData('checklist', { items }).items.length, LIMITS.itemsMax);
  assert.deepEqual(normalizeData('checklist', { items: [{ text: '  ', done: true }, { text: 'a', done: 'sì' }] }).items, [{ text: 'a', done: false }]);
  const cases = Array.from({ length: 6 }, () => ({ event: 'e', response: 'r' }));
  assert.equal(normalizeData('premeditatio', { cases }).cases.length, LIMITS.casesMax);
});

test('isEmptyData: vuoto = nessuno ha scritto o scelto niente', () => {
  for (const type of ['text', 'checklist', 'rating', 'choice', 'premeditatio', 'negvis', 'virtues', 'control', 'mood', 'evening']) {
    assert.equal(isEmptyData(type, defaultData(type)), true, type);
  }
  assert.equal(isEmptyData('text', { text: '   ' }), true); // solo spazi
  assert.equal(isEmptyData('text', { text: 'ciao' }), false);
  assert.equal(isEmptyData('checklist', { items: [{ text: 'a', done: false }] }), false);
  assert.equal(isEmptyData('rating', { value: 1 }), false);
  assert.equal(isEmptyData('choice', { value: 'a' }), false);
  assert.equal(isEmptyData('premeditatio', { cases: [{ event: '', response: 'qualcosa' }] }), false);
  assert.equal(isEmptyData('negvis', { appreciate: 'x' }), false);
  assert.equal(isEmptyData('virtues', { missed: ['giustizia'] }), false);
  assert.equal(isEmptyData('control', { notmine: 'x' }), false);
  assert.equal(isEmptyData('mood', { energy: 4 }), false);
  assert.equal(isEmptyData('evening', { answers: ['', '', 'x'] }), false);
  assert.equal(isEmptyData('evening', { variant: 'epitteto' }), true); // scegliere la versione non è scrivere
});

// ---------- moduli personalizzati ----------

test('creare un modulo: nome pulito, tipo valido, opzioni solo per «scelta»', async () => {
  const db = await freshDb();
  const a = await createCustomDef(db, { name: '  Gratitudine   di sera ', prompt: ' Per che cosa? ', type: 'text' }, NOW);
  assert.equal(a.name, 'Gratitudine di sera');
  assert.equal(a.prompt, 'Per che cosa?');
  assert.deepEqual(a.options, []);
  assert.equal(a.archived, false);
  assert.match(a.id, /^c-[0-9a-f-]{36}$/);
  assert.deepEqual(checkModuleDef(a), []);
  const c = await createCustomDef(db, { name: 'Ritmo', type: 'choice', options: ['calmo', ' veloce ', ''] }, NOW);
  assert.deepEqual(c.options, ['calmo', 'veloce']);
  const t = await createCustomDef(db, { name: 'Elenco', type: 'checklist', options: ['ignorate'] }, NOW);
  assert.deepEqual(t.options, []); // le opzioni contano solo per la scelta
  await assert.rejects(createCustomDef(db, { name: '   ', type: 'text' }), /nome/i);
  await assert.rejects(createCustomDef(db, { name: 'x', type: 'disegno' }), /tipo/i);
  await assert.rejects(createCustomDef(db, { name: 'x', type: 'choice', options: ['sola'] }), /opzioni/i);
  await assert.rejects(createCustomDef(db, { name: 'x'.repeat(LIMITS.name + 1), type: 'text' }), /nome/i);
  db.close();
});

test('elenco: prima i moduli già pronti (sopra, poi sotto), poi i tuoi; gli archiviati spariscono ma non i dati', async () => {
  const db = await freshDb();
  const mine = await createCustomDef(db, { name: 'Mio', type: 'text' }, NOW);
  const all = await listAllDefs(db);
  assert.deepEqual(all.map((d) => d.id), ['quote', 'goals', 'premeditatio', 'negvis', 'control', 'virtues', 'mood', 'evening', mine.id]);
  assert.ok(all.slice(0, 8).every((d) => d.builtin) && !all[8].builtin);

  await saveInstance(db, DAY, mine.id, 'text', { text: 'Ho una cosa scritta' }, NOW);
  await archiveCustomDef(db, mine.id, true, NOW);
  assert.equal((await listAllDefs(db)).length, 8);
  assert.equal((await listCustomDefs(db)).length, 0);
  assert.equal((await listAllDefs(db, { includeArchived: true })).length, 9);
  assert.equal((await getInstance(db, DAY, mine.id)).data.text, 'Ho una cosa scritta'); // i dati restano
  await archiveCustomDef(db, mine.id, false, NOW);
  assert.equal((await listAllDefs(db)).length, 9);
  db.close();
});

test('modificare un modulo: si cambiano nome e frase-guida, non il tipo né le opzioni', async () => {
  const db = await freshDb();
  const m = await createCustomDef(db, { name: 'Ritmo', type: 'choice', options: ['calmo', 'veloce'] }, NOW);
  const u = await updateCustomDef(db, m.id, { name: 'Passo', prompt: 'Com’è andato?', type: 'text', options: ['x'] }, new Date('2026-10-20T10:00:00Z'));
  assert.equal(u.name, 'Passo');
  assert.equal(u.prompt, 'Com’è andato?');
  assert.equal(u.type, 'choice');
  assert.deepEqual(u.options, ['calmo', 'veloce']);
  assert.equal(u.createdAt, m.createdAt);
  assert.notEqual(u.updatedAt, m.updatedAt);
  await assert.rejects(updateCustomDef(db, m.id, { name: '  ' }));
  await assert.rejects(updateCustomDef(db, 'c-non-esiste', { name: 'x' }), /non trovato/i);
  db.close();
});

// ---------- attivi di base ----------

test('attivi di base: all\'inizio solo gli obiettivi; la prima scelta fissa l\'elenco', async () => {
  const db = await freshDb();
  assert.deepEqual([...enabledIds(await getSettings(db))].sort(), ['goals', 'quote']); // gli obiettivi come prima dei moduli, più la frase del giorno
  await setModuleEnabled(db, 'premeditatio', true, NOW);
  let s = await getSettings(db);
  assert.equal(s.modulesConfigured, true);
  assert.deepEqual([...enabledIds(s)].sort(), ['goals', 'premeditatio', 'quote']);
  await setModuleEnabled(db, 'goals', false, NOW); // anche gli obiettivi si possono spegnere
  s = await getSettings(db);
  assert.deepEqual([...enabledIds(s)].sort(), ['premeditatio', 'quote']);
  await setModuleEnabled(db, 'premeditatio', true, NOW); // idempotente
  assert.deepEqual([...enabledIds(await getSettings(db))].sort(), ['premeditatio', 'quote']);
  // la frase del giorno si può spegnere: da quel momento vale la scelta fatta, anche dopo altri cambi
  await setModuleEnabled(db, 'quote', false, NOW);
  s = await getSettings(db);
  assert.equal(s.quoteChosen, true);
  assert.deepEqual([...enabledIds(s)], ['premeditatio']);
  await setModuleEnabled(db, 'goals', true, NOW);
  assert.deepEqual([...enabledIds(await getSettings(db))].sort(), ['goals', 'premeditatio']);
  await setModuleEnabled(db, 'quote', true, NOW);
  assert.deepEqual([...enabledIds(await getSettings(db))].sort(), ['goals', 'premeditatio', 'quote']);
  assert.equal(checkSettings({ quoteChosen: 'sì' }).length, 1);
  assert.deepEqual(checkSettings({ enabledModules: 'goals' }).length, 1);
  assert.deepEqual(checkSettings({ enabledModules: [''] }).length, 1);
  assert.deepEqual(checkSettings({ modulesConfigured: 'sì' }).length, 1);
  assert.deepEqual(checkSettings({ enabledModules: ['goals'], modulesConfigured: true }), []);
  db.close();
});

// ---------- un giorno ----------

test('visibilità in un giorno: aggiunto se non è attivo di base, nascosto se lo è', async () => {
  const db = await freshDb();
  const enabled = new Set(['goals']);
  let day = await getDay(db, DAY);
  assert.deepEqual(day, { date: DAY, added: [], hidden: [], updatedAt: null });
  assert.equal(isVisible('goals', enabled, day), true);
  assert.equal(isVisible('evening', enabled, day), false);

  await setVisibleForDay(db, DAY, 'evening', true, enabled, NOW); // aggiunto
  day = await getDay(db, DAY);
  assert.deepEqual(day.added, ['evening']);
  assert.equal(isVisible('evening', enabled, day), true);

  await setVisibleForDay(db, DAY, 'goals', false, enabled, NOW); // nascosto
  day = await getDay(db, DAY);
  assert.deepEqual(day.hidden, ['goals']);
  assert.equal(isVisible('goals', enabled, day), false);

  // idempotente, e niente elenchi inutili
  await setVisibleForDay(db, DAY, 'goals', false, enabled, NOW);
  assert.deepEqual((await getDay(db, DAY)).hidden, ['goals']);
  await setVisibleForDay(db, DAY, 'goals', true, enabled, NOW);
  day = await getDay(db, DAY);
  assert.deepEqual(day.hidden, []);
  assert.deepEqual(day.added, ['evening']); // «goals» è attivo di base: non finisce tra gli aggiunti
  await setVisibleForDay(db, DAY, 'evening', false, enabled, NOW);
  day = await getDay(db, DAY);
  assert.deepEqual(day, { ...day, added: [], hidden: [] }); // aggiunto e tolto: nessun resto
  assert.deepEqual(checkDayRecord(day), []);
  await assert.rejects(setVisibleForDay(db, '2026-02-30', 'goals', false, enabled));
  db.close();
});

test('se cambia l\'impostazione di base, un giorno già configurato resta coerente', async () => {
  const db = await freshDb();
  // «mood» nascosto in un giorno quando era attivo di base; poi viene spento nelle impostazioni
  await setVisibleForDay(db, DAY, 'mood', false, new Set(['mood']), NOW);
  let day = await getDay(db, DAY);
  assert.equal(isVisible('mood', new Set(), day), false); // spento e nascosto
  await setVisibleForDay(db, DAY, 'mood', true, new Set(), NOW); // lo si riaggiunge: va tolto da «nascosti»
  day = await getDay(db, DAY);
  assert.deepEqual(day.hidden, []);
  assert.deepEqual(day.added, ['mood']);
  assert.equal(isVisible('mood', new Set(), day), true);
  db.close();
});

// ---------- dati di un modulo ----------

test('salvare i dati: uno per giorno e modulo, createdAt si mantiene, il vuoto non crea nulla', async () => {
  const db = await freshDb();
  assert.equal(instanceId(DAY, 'evening'), '2026-10-19|evening');
  assert.equal(await saveInstance(db, DAY, 'evening', 'evening', defaultData('evening'), NOW), null); // niente da salvare
  assert.equal((await getAll(db, 'moduleInstances')).length, 0);

  const first = await saveInstance(db, DAY, 'evening', 'evening', { variant: 'epitteto', answers: ['ho ascoltato', '', ''] }, NOW);
  assert.equal(first.id, '2026-10-19|evening');
  assert.equal(first.entryId, null);
  assert.deepEqual(checkModuleInstance(first), []);
  const second = await saveInstance(db, DAY, 'evening', 'evening', { variant: 'epitteto', answers: ['ho ascoltato', 'ho aspettato', ''] }, new Date('2026-10-19T20:00:00Z'));
  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.updatedAt, first.updatedAt);
  assert.equal((await getAll(db, 'moduleInstances')).length, 1);

  // cancellando tutto il testo il record resta (non si perde nulla di nascosto): ora è vuoto ma esiste
  const cleared = await saveInstance(db, DAY, 'evening', 'evening', defaultData('evening'), NOW);
  assert.ok(cleared);
  assert.equal(hasContent({ type: 'evening' }, cleared), false);

  // dati storti vengono ripuliti prima di salvare
  const odd = await saveInstance(db, '2026-10-20', 'mood', 'mood', { mood: 9, energy: 2, extra: 'x' }, NOW);
  assert.deepEqual(odd.data, { mood: null, energy: 2 });
  await assert.rejects(saveInstance(db, DAY, 'goals', 'goals', {}), /non ha dati/);
  await assert.rejects(saveInstance(db, '2026-02-30', 'mood', 'mood', { mood: 1 }));
  db.close();
});

test('nascondere un modulo non cancella i dati: riattivandolo si ritrova tutto', async () => {
  const db = await freshDb();
  const enabled = new Set(['premeditatio']);
  const written = { cases: [{ event: 'una riunione difficile', response: 'respiro e ascolto' }] };
  await saveInstance(db, DAY, 'premeditatio', 'premeditatio', written, NOW);

  await setVisibleForDay(db, DAY, 'premeditatio', false, enabled, NOW);
  const defs = await listAllDefs(db);
  let arranged = arrangeForDay(defs, enabled, await getDay(db, DAY), await listInstancesForDay(db, DAY));
  assert.ok(!arranged.visible.some((d) => d.id === 'premeditatio'));
  assert.ok(arranged.available.some((d) => d.id === 'premeditatio'));
  assert.ok(arranged.withData.has('premeditatio')); // si sa che qui c'è già qualcosa di scritto

  await setVisibleForDay(db, DAY, 'premeditatio', true, enabled, NOW);
  arranged = arrangeForDay(defs, enabled, await getDay(db, DAY), await listInstancesForDay(db, DAY));
  assert.ok(arranged.visible.some((d) => d.id === 'premeditatio'));
  assert.deepEqual((await getInstance(db, DAY, 'premeditatio')).data, normalizeData('premeditatio', written));
  db.close();
});

// ---------- backup ----------

test('backup: moduli tuoi, giorni e dati dei moduli tornano identici, anche dopo «sostituisci»', async () => {
  const db = await freshDb();
  const mine = await createCustomDef(db, { name: 'Ritmo', prompt: 'Com’è?', type: 'choice', options: ['calmo', 'veloce'] }, NOW);
  await saveInstance(db, DAY, mine.id, 'choice', { value: 'calmo' }, NOW);
  await saveInstance(db, DAY, 'virtues', 'virtues', { exercised: ['coraggio'], missed: ['temperanza'], note: 'poca pazienza' }, NOW);
  await setVisibleForDay(db, DAY, 'evening', true, new Set(['goals']), NOW);
  await setModuleEnabled(db, 'virtues', true, NOW);

  const file = JSON.parse(JSON.stringify(await buildExport(db)));
  assert.equal(file.data.moduleDefs.length, 1);
  assert.equal(file.data.moduleInstances.length, 2);
  assert.equal(file.data.days.length, 1);
  const check = validateImport(file);
  assert.ok(check.ok, check.errors.join());

  const other = await freshDb();
  await importData(other, check.data, 'replace');
  for (const store of ['moduleDefs', 'moduleInstances', 'days']) {
    const sort = (rows) => rows.sort((a, b) => String(a.id ?? a.date).localeCompare(String(b.id ?? b.date)));
    assert.deepEqual(sort(await getAll(other, store)), sort(await getAll(db, store)), store);
  }
  // anche i moduli attivi di base viaggiano con le impostazioni
  assert.deepEqual([...enabledIds(await getSettings(other))].sort(), ['goals', 'quote', 'virtues']);
  db.close();
  other.close();
});

test('backup: dati dei moduli sbagliati vengono respinti con un messaggio chiaro', async () => {
  const db = await freshDb();
  const mine = await createCustomDef(db, { name: 'Ritmo', type: 'text' }, NOW);
  await saveInstance(db, DAY, mine.id, 'text', { text: 'ok' }, NOW);
  await setVisibleForDay(db, DAY, 'evening', true, new Set(), NOW);
  const good = JSON.parse(JSON.stringify(await buildExport(db)));
  assert.ok(validateImport(good).ok);

  const bad = {
    'modulo con id di un modulo già pronto': (f) => (f.data.moduleDefs[0].id = 'evening'),
    'modulo senza nome': (f) => (f.data.moduleDefs[0].name = ' '),
    'tipo sconosciuto': (f) => (f.data.moduleDefs[0].type = 'disegno'),
    'dati con id incoerente': (f) => (f.data.moduleInstances[0].id = 'altro'),
    'dati non oggetto': (f) => (f.data.moduleInstances[0].data = 'testo'),
    'dati enormi': (f) => (f.data.moduleInstances[0].data = { text: 'x'.repeat(LIMITS.dataBytes + 10) }),
    'giorno con elenco sbagliato': (f) => (f.data.days[0].added = 'evening'),
    'impostazione moduli sbagliata': (f) => (f.data.settings[0].enabledModules = 'tutti'),
  };
  for (const [name, mutate] of Object.entries(bad)) {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    assert.equal(validateImport(copy).ok, false, name);
  }
  db.close();
});

test('un backup di prima dei moduli (senza questi campi) si importa e funziona come prima', async () => {
  const db = await freshDb();
  const file = JSON.parse(JSON.stringify(await buildExport(db)));
  delete file.data.settings[0]?.modulesConfigured;
  delete file.data.settings[0]?.enabledModules;
  const check = validateImport(file);
  assert.ok(check.ok, check.errors.join());
  const other = await freshDb();
  await importData(other, check.data, 'replace');
  assert.deepEqual([...enabledIds(await getSettings(other))].sort(), ['goals', 'quote']);
  db.close();
  other.close();
});

// ---------- ordine dei blocchi nella pagina ----------

test('ordine: quello di partenza è moduli sopra, voci, moduli sotto, poi i tuoi', () => {
  assert.deepEqual(defaultOrder(['c-1']), ['quote', 'goals', 'premeditatio', 'negvis', ENTRIES_ID, 'control', 'virtues', 'mood', 'evening', 'c-1']);
});

test('ordine: resolveOrder tiene quello salvato, scarta ciò che non esiste e mette in coda ciò che manca', () => {
  const saved = ['evening', 'ghost', ENTRIES_ID, 'evening', 'goals'];
  const order = resolveOrder(saved, ['c-1']);
  assert.deepEqual(order.slice(0, 3), ['evening', ENTRIES_ID, 'goals']);
  assert.ok(!order.includes('ghost'));
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual([...order].sort(), [...defaultOrder(['c-1'])].sort());
  assert.deepEqual(resolveOrder(undefined, []), defaultOrder());
  assert.deepEqual(resolveOrder('boh', []), defaultOrder());
});

test('ordine: moveInOrder sposta di un posto fra quelli mostrati e si ferma ai margini', () => {
  const order = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveInOrder(order, order, 'c', -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveInOrder(order, order, 'b', 1), ['a', 'c', 'b', 'd']);
  assert.equal(moveInOrder(order, order, 'a', -1), order);
  assert.equal(moveInOrder(order, order, 'd', 1), order);
  // un blocco nascosto (archiviato) in mezzo non conta: si scavalca il vicino visibile
  assert.deepEqual(moveInOrder(order, ['a', 'c', 'd'], 'c', -1), ['c', 'a', 'b', 'd']);
  assert.deepEqual(moveInOrder(order, ['a', 'c', 'd'], 'a', 1), ['b', 'c', 'a', 'd']);
});

test('ordine: orderDefs mette i moduli nell\'ordine scelto e ricava sopra/sotto dalla posizione delle voci', async () => {
  const db = await freshDb();
  const mine = await createCustomDef(db, { name: 'Mio', type: 'text' }, NOW);
  const defs = await listAllDefs(db);
  const slots = (list) => list.map((d) => `${d.id}:${d.slot}`);
  // senza ordine salvato: come prima della scelta
  const base = orderDefs(defs, []);
  assert.deepEqual(base.map((d) => d.id), ['quote', 'goals', 'premeditatio', 'negvis', 'control', 'virtues', 'mood', 'evening', mine.id]);
  assert.ok(base.filter((d) => ['quote', 'goals', 'premeditatio', 'negvis'].includes(d.id)).every((d) => d.slot === 'top'));
  assert.ok(base.filter((d) => !['quote', 'goals', 'premeditatio', 'negvis'].includes(d.id)).every((d) => d.slot === 'bottom'));
  // le voci in cima: tutto va sotto
  const entriesFirst = orderDefs(defs, [ENTRIES_ID, 'evening', 'goals']);
  assert.deepEqual(entriesFirst.slice(0, 2).map((d) => d.id), ['evening', 'goals']);
  assert.ok(entriesFirst.every((d) => d.slot === 'bottom'), slots(entriesFirst).join());
  // le voci in fondo: tutto va sopra, anche il modulo tuo
  const entriesLast = orderDefs(defs, [mine.id, ...defaultOrder([mine.id]).filter((id) => id !== ENTRIES_ID && id !== mine.id), ENTRIES_ID]);
  assert.equal(entriesLast[0].id, mine.id);
  assert.ok(entriesLast.every((d) => d.slot === 'top'));
  // un elenco salvato a metà lascia le voci dov'erano di partenza
  assert.equal(orderDefs(defs, [mine.id, 'negvis']).find((d) => d.id === 'control').slot, 'bottom');
  // un modulo archiviato non compare ma non rompe l'ordine
  assert.equal((await listAllDefs(db)).length, 9);
});

test('ordine: si salva nelle impostazioni, si controlla e passa nel backup', async () => {
  const db = await freshDb();
  assert.deepEqual((await getSettings(db)).moduleOrder, []);
  await setModuleOrder(db, ['evening', ENTRIES_ID, 'goals'], NOW);
  assert.deepEqual((await getSettings(db)).moduleOrder, ['evening', ENTRIES_ID, 'goals']);
  assert.equal(checkSettings({ moduleOrder: 'x' }).length, 1);
  assert.equal(checkSettings({ moduleOrder: [1] }).length, 1);
  assert.deepEqual(checkSettings({ moduleOrder: ['goals', ENTRIES_ID] }), []);
  const file = await buildExport(db, NOW);
  const other = await freshDb();
  const check = validateImport(JSON.parse(JSON.stringify(file)));
  assert.ok(check.ok);
  await importData(other, check.data, 'replace');
  assert.deepEqual((await getSettings(other)).moduleOrder, ['evening', ENTRIES_ID, 'goals']);
});
