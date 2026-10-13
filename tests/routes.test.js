import test from 'node:test';
import assert from 'node:assert/strict';
import { dayHash, parseRoute } from '../js/routes.js';

test('parseRoute riconosce le schermate', () => {
  assert.deepEqual(parseRoute(''), { name: 'today' });
  assert.deepEqual(parseRoute('#/oggi'), { name: 'today' });
  assert.deepEqual(parseRoute('#/impostazioni'), { name: 'settings' });
  assert.deepEqual(parseRoute('#/giorno/2026-10-12'), { name: 'day', date: '2026-10-12' });
});

test('parseRoute: indirizzi strani tornano a Oggi', () => {
  assert.deepEqual(parseRoute('#/giorno/2026-02-30'), { name: 'today' });
  assert.deepEqual(parseRoute('#/giorno/ieri'), { name: 'today' });
  assert.deepEqual(parseRoute('#/boh'), { name: 'today' });
});

test('dayHash: oggi ha il suo indirizzo', () => {
  assert.equal(dayHash('2026-10-13', '2026-10-13'), '#/oggi');
  assert.equal(dayHash('2026-10-12', '2026-10-13'), '#/giorno/2026-10-12');
});
