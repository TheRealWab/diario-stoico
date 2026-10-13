import test from 'node:test';
import assert from 'node:assert/strict';
import { dayHash, familyOf, isTabRoute, parseRoute, tabHashOf } from '../js/routes.js';

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

test('tipi di schermata e voce attiva della barra', () => {
  assert.ok(isTabRoute(parse('#/archivio/cerca')) && isTabRoute(parse('#/impostazioni')));
  assert.ok(!isTabRoute(parse('#/oggi')) && !isTabRoute(parse('#/giorno/2026-10-12')));
  assert.equal(tabHashOf(parse('#/giorno/2026-10-12')), '#/oggi');
  assert.equal(tabHashOf(parse('#/archivio/cronologia')), '#/archivio');
  assert.equal(tabHashOf(parse('#/impostazioni')), '#/impostazioni');
  assert.equal(familyOf(parse('#/archivio')), 'archive');
  assert.equal(familyOf(parse('#/oggi')), 'home');
});
