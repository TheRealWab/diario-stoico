import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { dataSummary, openIds, setModuleEnabled, setModuleOpen } from '../js/modules.js';
import { DEFAULT_SETTINGS, changeSettings, checkSettings, getSettings, saveSettings } from '../js/settings.js';

test('moduli aperti: all’inizio solo frase del giorno e obiettivi, anche per chi aveva già l’app', async () => {
  assert.deepEqual(DEFAULT_SETTINGS.openModules, ['quote', 'goals']);
  const db = await freshDb();
  await saveSettings(db, { theme: 'scuro' }); // impostazioni salvate da una versione precedente: senza l'elenco
  assert.deepEqual([...openIds(await getSettings(db))], ['quote', 'goals']);
  db.close();
});

test('aprire e chiudere un modulo si ricorda, senza toccare il resto delle impostazioni', async () => {
  const db = await freshDb();
  await setModuleEnabled(db, 'evening', true);
  await setModuleOpen(db, 'evening', true);
  await setModuleOpen(db, 'quote', false);
  let s = await getSettings(db);
  assert.deepEqual([...openIds(s)].sort(), ['evening', 'goals']);
  assert.ok(s.enabledModules.includes('evening')); // accesi e aperti sono due cose diverse
  await setModuleOpen(db, 'evening', true); // due volte: nessun doppione
  await setModuleOpen(db, 'evening', false);
  s = await getSettings(db);
  assert.deepEqual([...openIds(s)], ['goals']);
  db.close();
});

test('due tocchi ravvicinati su moduli diversi non si pestano i piedi', async () => {
  const db = await freshDb();
  await Promise.all([setModuleOpen(db, 'mood', true), setModuleOpen(db, 'virtues', true), setModuleOpen(db, 'goals', false)]);
  assert.deepEqual([...openIds(await getSettings(db))].sort(), ['mood', 'quote', 'virtues']);
  db.close();
});

test('changeSettings: parte dai valori attuali e rifiuta quelli non validi senza scrivere', async () => {
  const db = await freshDb();
  await changeSettings(db, (s) => ({ openModules: [...s.openModules, 'x'] }));
  assert.deepEqual((await getSettings(db)).openModules, ['quote', 'goals', 'x']);
  await assert.rejects(changeSettings(db, () => ({ openModules: 'tutti' })), /openModules/);
  assert.deepEqual((await getSettings(db)).openModules, ['quote', 'goals', 'x']);
  assert.equal(checkSettings({ openModules: [''] }).length, 1);
  db.close();
});

test('dataSummary: quello che c’è in un modulo chiuso, in una riga', () => {
  assert.equal(dataSummary('mood', { mood: 4, energy: 3 }), 'Bene · energia media');
  assert.equal(dataSummary('mood', { mood: null, energy: 1 }), 'energia scarica');
  assert.equal(dataSummary('virtues', { exercised: ['coraggio', 'saggezza'], missed: ['temperanza'], note: 'con calma' }), 'Esercitata: coraggio, saggezza · Da curare: temperanza · con calma');
  assert.equal(dataSummary('premeditatio', { cases: [{ event: 'Piove', response: 'Esco lo stesso' }] }), 'Piove · Esco lo stesso');
  assert.equal(dataSummary('evening', { answers: ['uno', '', 'tre'] }), 'uno · tre');
  assert.equal(dataSummary('rating', { value: 4 }), '4 su 5');
  assert.equal(dataSummary('choice', { value: 'Sì' }), 'Sì');
  assert.equal(dataSummary('checklist', { items: [{ text: 'acqua', done: true }, { text: 'pane', done: false }] }), 'acqua · pane');
  // vuoto (o dati mancanti): nessuna riga
  for (const type of ['text', 'mood', 'virtues', 'premeditatio', 'evening', 'rating', 'choice', 'checklist', 'negvis', 'control']) {
    assert.equal(dataSummary(type, null), '', type);
  }
});
