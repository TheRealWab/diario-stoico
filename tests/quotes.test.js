import test from 'node:test';
import assert from 'node:assert/strict';
import { EPITTETO, EPITTETO_SOURCE, OPENING_QUOTES, QUOTES, quoteForDate } from '../js/quotes.js';
import { addDays } from '../js/dates.js';

test('citazione del giorno: la stessa per tutto il giorno, diversa dal giorno dopo', () => {
  let day = '2026-10-01';
  for (let i = 0; i < 90; i++) {
    const today = quoteForDate(day);
    assert.deepEqual(quoteForDate(day), today); // sempre la stessa
    const next = addDays(day, 1);
    assert.notEqual(quoteForDate(next).text, today.text, `${day} → ${next}`);
    day = next;
  }
});

test('citazione del giorno: si usano tutte le frasi, quelle di Epitteto hanno sempre l\'attribuzione', () => {
  const used = new Set();
  let day = '2026-01-01';
  for (let i = 0; i < 400; i++, day = addDays(day, 1)) used.add(quoteForDate(day).text);
  assert.equal(used.size, OPENING_QUOTES.length);
  for (const q of OPENING_QUOTES) {
    assert.ok(q.text.length > 10 && q.text.length < 260, q.text);
    assert.equal(q.source, EPITTETO.includes(q.text) ? EPITTETO_SOURCE : null);
  }
  assert.equal(OPENING_QUOTES.length, QUOTES.length + EPITTETO.length);
});
