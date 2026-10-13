import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysAgoLabel, daysBetween, formatLong, formatLongParts,
  isValidDateStr, isValidTimeStr, timeStr, todayStr,
} from '../js/dates.js';

test('todayStr usa il fuso di Roma, non UTC', () => {
  // 22:30 UTC del 12 ottobre = 00:30 del 13 a Roma (ora legale, UTC+2)
  assert.equal(todayStr(new Date('2026-10-12T22:30:00Z')), '2026-10-13');
  // 23:30 UTC del 31 dicembre = 00:30 del 1° gennaio a Roma (UTC+1)
  assert.equal(todayStr(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(todayStr(new Date('2026-10-13T10:00:00Z')), '2026-10-13');
});

test('timeStr: ora di Roma, anche a mezzanotte', () => {
  assert.equal(timeStr(new Date('2026-10-13T07:41:00Z')), '09:41');
  assert.equal(timeStr(new Date('2026-12-31T23:05:00Z')), '00:05');
  assert.ok(isValidTimeStr(timeStr(new Date())));
});

test('isValidDateStr', () => {
  assert.ok(isValidDateStr('2026-10-13'));
  assert.ok(isValidDateStr('2028-02-29'));
  assert.ok(!isValidDateStr('2027-02-29'));
  assert.ok(!isValidDateStr('2026-02-30'));
  assert.ok(!isValidDateStr('2026-13-01'));
  assert.ok(!isValidDateStr('2026-1-1'));
  assert.ok(!isValidDateStr('13/10/2026'));
  assert.ok(!isValidDateStr(null));
});

test('addDays attraversa mesi, anni, bisestili e cambio ora legale', () => {
  assert.equal(addDays('2026-10-13', 1), '2026-10-14');
  assert.equal(addDays('2026-10-13', -1), '2026-10-12');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  // fine ora legale 2026: domenica 25 ottobre
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  // inizio ora legale 2026: domenica 29 marzo
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-10-13', '2026-10-13'), 0);
  assert.equal(daysBetween('2026-10-10', '2026-10-13'), 3);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-10-13', '2026-10-10'), -3);
});

test('formatLong in italiano', () => {
  assert.equal(formatLong('2026-10-13'), 'martedì 13 ottobre 2026');
  assert.equal(formatLong('2027-01-01'), 'venerdì 1 gennaio 2027');
  assert.deepEqual(formatLongParts('2026-10-13'), { weekday: 'martedì', rest: '13 ottobre 2026' });
});

test('daysAgoLabel', () => {
  assert.equal(daysAgoLabel(null, '2026-10-13'), 'mai');
  assert.equal(daysAgoLabel('2026-10-13', '2026-10-13'), 'oggi');
  assert.equal(daysAgoLabel('2026-10-12', '2026-10-13'), '1 giorno fa');
  assert.equal(daysAgoLabel('2026-10-08', '2026-10-13'), '5 giorni fa');
});
