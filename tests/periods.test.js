import test from 'node:test';
import assert from 'node:assert/strict';
import { canBeParent, containsDate, periodFor, periodLabel, periodsWithin, shiftPeriod, shorterHorizons } from '../js/periods.js';
import { CLOSURE_POLICY, needsClosure } from '../js/goals-policy.js';

test('giorno: un solo giorno', () => {
  assert.deepEqual(periodFor('giorno', '2026-10-13'), { start: '2026-10-13', end: '2026-10-13' });
});

test('settimana: da lunedì a domenica, qualunque giorno si parta', () => {
  const week = { start: '2026-10-12', end: '2026-10-18' };
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-18']) assert.deepEqual(periodFor('settimana', d), week, d);
  assert.deepEqual(periodFor('settimana', '2026-10-19'), { start: '2026-10-19', end: '2026-10-25' });
});

test('settimana a cavallo di due mesi e di due anni', () => {
  assert.deepEqual(periodFor('settimana', '2026-10-01'), { start: '2026-09-28', end: '2026-10-04' });
  assert.deepEqual(periodFor('settimana', '2027-01-01'), { start: '2026-12-28', end: '2027-01-03' });
});

test('mese e anno, anche bisestile', () => {
  assert.deepEqual(periodFor('mese', '2026-10-13'), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(periodFor('mese', '2027-02-10'), { start: '2027-02-01', end: '2027-02-28' });
  assert.deepEqual(periodFor('mese', '2028-02-10'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(periodFor('anno', '2026-10-13'), { start: '2026-01-01', end: '2026-12-31' });
  assert.throws(() => periodFor('decennio', '2026-10-13'));
});

test('shiftPeriod: avanti e indietro', () => {
  assert.deepEqual(shiftPeriod('giorno', '2026-12-31', 1), { start: '2027-01-01', end: '2027-01-01' });
  assert.deepEqual(shiftPeriod('settimana', '2026-10-12', 1), { start: '2026-10-19', end: '2026-10-25' });
  assert.deepEqual(shiftPeriod('settimana', '2026-10-12', -2), { start: '2026-09-28', end: '2026-10-04' });
  assert.deepEqual(shiftPeriod('mese', '2026-12-01', 1), { start: '2027-01-01', end: '2027-01-31' });
  assert.deepEqual(shiftPeriod('mese', '2026-01-01', -1), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(shiftPeriod('anno', '2026-01-01', 1), { start: '2027-01-01', end: '2027-12-31' });
});

test('containsDate: estremi compresi', () => {
  const p = periodFor('mese', '2026-10-13');
  assert.ok(containsDate(p, '2026-10-01') && containsDate(p, '2026-10-31'));
  assert.ok(!containsDate(p, '2026-09-30') && !containsDate(p, '2026-11-01'));
});

test('cascata: genitore di orizzonte più lungo che contiene la data di INIZIO', () => {
  const month = (ym) => ({ horizon: 'mese', ...periodFor('mese', `${ym}-01`) });
  const week = { horizon: 'settimana', start: '2026-09-28' }; // 28 set – 4 ott: comincia a settembre
  assert.ok(canBeParent(week, month('2026-09')));
  assert.ok(!canBeParent(week, month('2026-10')));
  assert.ok(canBeParent({ horizon: 'giorno', start: '2026-10-03' }, { horizon: 'settimana', ...periodFor('settimana', '2026-09-28') }));
  assert.ok(canBeParent({ horizon: 'giorno', start: '2026-10-03' }, month('2026-10'))); // si può saltare un livello
  assert.ok(canBeParent({ horizon: 'mese', start: '2026-10-01' }, { horizon: 'anno', ...periodFor('anno', '2026-06-01') }));
  assert.ok(!canBeParent({ horizon: 'mese', start: '2026-10-01' }, month('2026-10'))); // stesso orizzonte
  assert.ok(!canBeParent({ horizon: 'mese', start: '2026-10-01' }, { horizon: 'settimana', ...periodFor('settimana', '2026-10-01') })); // più corto
});

test('shorterHorizons e periodsWithin', () => {
  assert.deepEqual(shorterHorizons('mese'), ['settimana', 'giorno']);
  assert.deepEqual(shorterHorizons('giorno'), []);
  const october = { horizon: 'mese', ...periodFor('mese', '2026-10-01') };
  // il lunedì 28 settembre appartiene a settembre: in ottobre le settimane cominciano il 5, 12, 19, 26
  assert.deepEqual(periodsWithin(october, 'settimana').map((p) => p.start), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  assert.equal(periodsWithin(october, 'giorno').length, 31);
  assert.equal(periodsWithin({ horizon: 'anno', ...periodFor('anno', '2026-01-01') }, 'mese').length, 12);
  assert.equal(periodsWithin({ horizon: 'settimana', ...periodFor('settimana', '2026-10-13') }, 'giorno').length, 7);
  assert.deepEqual(periodsWithin(october, 'mese'), []);
  // un mese che comincia di lunedì include la sua prima settimana
  assert.equal(periodsWithin({ horizon: 'mese', ...periodFor('mese', '2027-02-01') }, 'settimana')[0].start, '2027-02-01');
});

test('periodLabel', () => {
  assert.equal(periodLabel('giorno', '2026-10-13'), 'martedì 13 ottobre 2026');
  assert.equal(periodLabel('settimana', '2026-10-12'), '12 ott – 18 ott 2026');
  assert.equal(periodLabel('settimana', '2026-09-28'), '28 set – 4 ott 2026');
  assert.equal(periodLabel('settimana', '2026-12-28'), '28 dic 2026 – 3 gen 2027');
  assert.equal(periodLabel('mese', '2026-10-01'), 'ottobre 2026');
  assert.equal(periodLabel('anno', '2026-01-01'), '2026');
});

// ---------- quando si propone la chiusura ----------

const goal = (over) => ({ status: 'da_fare', horizon: 'settimana', end: '2026-10-18', ...over });

test('chiusura: solo periodi finiti, ancora «da fare», di settimane/mesi/anni', () => {
  const today = '2026-10-20';
  assert.ok(needsClosure(goal(), today));
  assert.ok(needsClosure(goal({ horizon: 'mese', end: '2026-09-30' }), today));
  assert.ok(needsClosure(goal({ horizon: 'anno', end: '2025-12-31' }), '2026-01-10'));
  assert.ok(!needsClosure(goal({ horizon: 'giorno', end: '2026-10-19' }), today), 'i giorni non si propongono mai');
  assert.ok(!needsClosure(goal({ status: 'fatto' }), today));
  assert.ok(!needsClosure(goal({ status: 'non_riuscito' }), today));
  assert.ok(!needsClosure(goal({ status: 'rimandato' }), today));
  assert.ok(!needsClosure(goal({ end: '2026-10-20' }), today), 'il periodo finisce oggi: non è ancora concluso');
  assert.ok(!needsClosure(goal({ end: '2026-10-25' }), today), 'periodo in corso');
});

test('chiusura: finestra di 60 giorni, estremo compreso', () => {
  assert.equal(CLOSURE_POLICY.windowDays, 60);
  const today = '2026-10-20';
  assert.ok(needsClosure(goal({ end: '2026-08-21' }), today)); // 60 giorni fa
  assert.ok(!needsClosure(goal({ end: '2026-08-20' }), today)); // 61 giorni fa
});

test('chiusura: la regola si può cambiare passando un\'altra politica', () => {
  const all = { horizons: ['giorno', 'settimana', 'mese', 'anno'], windowDays: 5 };
  assert.ok(needsClosure(goal({ horizon: 'giorno', end: '2026-10-19' }), '2026-10-20', all));
  assert.ok(!needsClosure(goal({ end: '2026-10-10' }), '2026-10-20', all));
});
