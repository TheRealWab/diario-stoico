import test from 'node:test';
import assert from 'node:assert/strict';
import { CITAZIONI } from '../js/citazioni.js';
import { QUOTES, quoteForDate, randomQuote } from '../js/quotes.js';
import { addDays } from '../js/dates.js';

test('frasi: ce ne sono 366 (una per ogni giorno, anche bisestile), tutte complete e senza doppioni', () => {
  assert.equal(QUOTES.length, 366);
  assert.equal(new Set(QUOTES.map((q) => q.text)).size, 366);
  for (const q of QUOTES) {
    assert.ok(q.text.length >= 15 && q.text.length <= 450, q.text);
    assert.ok(q.author && q.source && q.translation, q.text);
    assert.equal(q.text, q.text.trim());
    assert.ok(/[.?!»"’)]$/.test(q.text), `senza punto finale: ${q.text}`);
  }
});

test('frasi: la forma è uniforme (apostrofi tipografici, accenti gravi, niente spazi doppi) e le fonti sono libere da diritti', () => {
  for (const q of CITAZIONI) {
    assert.ok(!/[áíú]/i.test(q.t), `accento antico: ${q.t}`);
    assert.ok(!q.t.includes("'"), `apostrofo dritto: ${q.t}`);
    assert.ok(!/\s{2,}|\n/.test(q.t), `spazi doppi: ${q.t}`);
    assert.ok(!/‘\s|\s’/.test(q.t), `virgolette staccate: ${q.t}`);
    assert.ok(!/\[|\]|modifica|<|>/.test(q.t), `resti della pagina web: ${q.t}`);
  }
  // le traduzioni sono tutte di autori morti da oltre settant'anni o anonime (elenco chiuso)
  const OK = ['Umberto Moricca', 'Giacomo Leopardi', 'Annibale Caro', 'Francesco Acri', 'Cesare Dalbono', 'Michele Battaglia', 'volgarizzamento anonimo', 'Luigi Lechi'];
  for (const q of CITAZIONI) assert.ok(OK.some((n) => q.tr.startsWith(n)), `traduzione non prevista: ${q.tr}`);
});

test('frase del giorno: la stessa per tutto il giorno, diversa dal giorno dopo, con un autore diverso', () => {
  let day = '2026-10-01';
  for (let i = 0; i < 400; i++) {
    const today = quoteForDate(day);
    assert.equal(quoteForDate(day), today); // sempre la stessa
    const next = addDays(day, 1);
    assert.notEqual(quoteForDate(next).text, today.text, `${day} → ${next}`);
    assert.notEqual(quoteForDate(next).author, today.author, `stesso autore ${day} → ${next}`);
    day = next;
  }
});

test('frase del giorno: in 366 giorni si usano tutte le frasi, una sola volta', () => {
  const used = new Set();
  let day = '2027-03-01';
  for (let i = 0; i < 366; i++, day = addDays(day, 1)) used.add(quoteForDate(day).text);
  assert.equal(used.size, 366);
  // anche prima del 2026 (giorni negativi) la funzione risponde
  assert.ok(quoteForDate('2025-12-31').text);
});

test('frase della schermata di blocco: breve e con autore', () => {
  for (let i = 0; i < 30; i++) {
    const q = randomQuote();
    assert.ok(q.text.length <= 130 && q.author);
  }
});

test('frasi: alcune frasi note sono presenti alla lettera, con la fonte giusta', () => {
  const find = (text) => QUOTES.find((q) => q.text === text);
  assert.equal(find('Ricevi senza boria, lascia senza riluttanza.')?.source, 'Ricordi, VIII, 33');
  assert.equal(find('Gli uomini sono agitati e turbati, non dalle cose, ma dalle opinioni ch’eglino hanno delle cose.')?.source, 'Manuale, 5');
  assert.equal(find('Ogni cosa ha, per maniera di dire, due manichi: a pigliarla dall’uno, ella si sopporta, dall’altro no.')?.author, 'Epitteto');
});

test('frasi: gli estratti da metà periodo sono segnati', () => {
  const estratti = QUOTES.filter((q) => q.excerpt);
  assert.ok(estratti.length > 0 && estratti.length < 150);
  assert.ok(estratti.every((q) => /^[A-ZÀ-Ý«"“‘]/.test(q.text) || /^\p{Lu}/u.test(q.text)), 'un estratto comincia con la maiuscola');
});
