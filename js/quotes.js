// La frase del giorno, in cima a «Oggi».
// I dati stanno in citazioni.js: frasi alla lettera da testi antichi in traduzioni libere da diritti, con autore e fonte.

import { CITAZIONI } from './citazioni.js';
import { daysBetween } from './dates.js';

/** { text, author, source, translation, excerpt } */
export const QUOTES = Object.freeze(
  CITAZIONI.map((q) => Object.freeze({ text: q.t, author: q.a, source: q.f, translation: q.tr, excerpt: q.e === 1 })),
);

/**
 * La frase del giorno: la stessa per tutto il giorno, diversa dal giorno prima e da quello dopo, mai ripetuta in
 * un ciclo di tutte le frasi (366 giorni). Dipende solo dalla data: nessun caso, nessuna rete. L'ordine dell'elenco è già
 * mescolato, così due giorni di fila non hanno mai lo stesso autore.
 */
export function quoteForDate(date) {
  const n = daysBetween('2026-01-01', date);
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
