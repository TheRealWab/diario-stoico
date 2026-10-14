import test from 'node:test';
import assert from 'node:assert/strict';
import { activeTab, dayHash, familyOf, goalHash, goalsHash, isTabRoute, parseRoute, tabHashOf } from '../js/routes.js';

const TODAY = '2026-10-13';
const parse = (h) => parseRoute(h, TODAY);

test('Oggi e indirizzo vuoto', () => {
  assert.deepEqual(parse(''), { name: 'today', date: TODAY, mode: 'edit' });
  assert.deepEqual(parse('#/oggi'), { name: 'today', date: TODAY, mode: 'edit' });
  assert.deepEqual(parse('#/giorno/2026-10-13'), { name: 'today', date: TODAY, mode: 'edit' });
});

test('giorni passati in lettura, futuri in modifica, "/modifica" forza la modifica', () => {
  assert.deepEqual(parse('#/giorno/2026-10-12'), { name: 'day', date: '2026-10-12', mode: 'read' });
  assert.deepEqual(parse('#/giorno/2026-10-12/modifica'), { name: 'day', date: '2026-10-12', mode: 'edit' });
  assert.deepEqual(parse('#/giorno/2026-10-14'), { name: 'day', date: '2026-10-14', mode: 'edit' });
});

test('archivio e impostazioni', () => {
  assert.deepEqual(parse('#/impostazioni'), { name: 'settings' });
  assert.deepEqual(parse('#/archivio'), { name: 'archive', section: 'calendar', month: null });
  assert.deepEqual(parse('#/archivio/mese/2026-08'), { name: 'archive', section: 'calendar', month: '2026-08' });
  assert.deepEqual(parse('#/archivio/cronologia'), { name: 'archive', section: 'history' });
  assert.deepEqual(parse('#/archivio/cerca'), { name: 'archive', section: 'search' });
});

test('indirizzi strani tornano a Oggi', () => {
  for (const h of ['#/giorno/2026-02-30', '#/giorno/ieri', '#/boh', '#/archivio/mese/2026-13', '#/giorno/2026-10-12/altro']) {
    assert.equal(parse(h).name, 'today', h);
  }
});

test('dayHash', () => {
  assert.equal(dayHash('2026-10-13', TODAY), '#/oggi');
  assert.equal(dayHash('2026-10-12', TODAY), '#/giorno/2026-10-12');
  assert.equal(dayHash('2026-10-12', TODAY, { edit: true }), '#/giorno/2026-10-12/modifica');
  assert.equal(dayHash('2026-10-14', TODAY, { edit: true }), '#/giorno/2026-10-14');
  assert.equal(dayHash('2026-10-13', TODAY, { edit: true }), '#/oggi');
});

test('obiettivi: elenco per orizzonte e periodo, e dettaglio', () => {
  assert.deepEqual(parse('#/obiettivi'), { name: 'goals', horizon: null, date: null });
  assert.deepEqual(parse('#/obiettivi/settimana'), { name: 'goals', horizon: 'settimana', date: null });
  assert.deepEqual(parse('#/obiettivi/mese/2026-09-15'), { name: 'goals', horizon: 'mese', date: '2026-09-15' });
  assert.deepEqual(parse('#/obiettivo/3f2a9c1e-0b7d-4c55-9e0a-1d2e3f4a5b6c'), { name: 'goal', id: '3f2a9c1e-0b7d-4c55-9e0a-1d2e3f4a5b6c' });
  for (const h of ['#/obiettivi/secolo', '#/obiettivi/mese/2026-13-01', '#/obiettivi/mese/ieri', '#/obiettivo/', '#/obiettivo/a b']) {
    assert.equal(parse(h).name, 'today', h);
  }
  assert.equal(goalsHash('mese'), '#/obiettivi/mese');
  assert.equal(goalsHash('mese', '2026-10-01'), '#/obiettivi/mese/2026-10-01');
  assert.equal(goalHash('abc'), '#/obiettivo/abc');
});

test('voce della barra: i dettagli lasciano accesa la voce da cui sono stati aperti', () => {
  const goal = parse('#/obiettivo/abc');
  const day = parse('#/giorno/2026-10-12');
  assert.equal(activeTab(goal, { depth: 1 }), '#/obiettivi'); // aperto direttamente
  assert.equal(activeTab(goal, { depth: 2, parent: 'home' }), '#/oggi'); // dalla striscia di Oggi
  assert.equal(activeTab(goal, { depth: 3, parent: 'goals' }), '#/obiettivi');
  assert.equal(activeTab(day, { depth: 3, parent: 'archive' }), '#/archivio');
  assert.equal(activeTab(day, { depth: 3, parent: 'goals' }), '#/obiettivi');
  assert.equal(activeTab(day, { depth: 1 }), '#/oggi');
  assert.equal(activeTab(parse('#/archivio'), { depth: 2, parent: 'home' }), '#/archivio'); // le schede principali si accendono da sole
  assert.equal(activeTab(parse('#/impostazioni'), undefined), '#/impostazioni');
  assert.equal(activeTab(parse('#/obiettivi'), { depth: 2 }), '#/obiettivi');
});

test('tipi di schermata e voce attiva della barra', () => {
  assert.ok(isTabRoute(parse('#/archivio/cerca')) && isTabRoute(parse('#/impostazioni')));
  assert.ok(!isTabRoute(parse('#/oggi')) && !isTabRoute(parse('#/giorno/2026-10-12')));
  assert.equal(tabHashOf(parse('#/giorno/2026-10-12')), '#/oggi');
  assert.equal(tabHashOf(parse('#/archivio/cronologia')), '#/archivio');
  assert.equal(tabHashOf(parse('#/impostazioni')), '#/impostazioni');
  assert.equal(familyOf(parse('#/archivio')), 'archive');
  assert.equal(familyOf(parse('#/oggi')), 'home');
});
