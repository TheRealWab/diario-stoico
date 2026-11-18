// La frase del giorno, in cima a «Oggi».
// I dati stanno in citazioni.js: ogni frase in italiano di oggi (quella che si legge) e il testo alla lettera da cui viene.

import { CITAZIONI } from './citazioni.js';
import { daysBetween } from './dates.js';

/** { text (italiano di oggi), author, source, original (alla lettera), translation, excerpt } */
export const QUOTES = Object.freeze(
  CITAZIONI.map((q) => Object.freeze({ text: q.m, author: q.a, source: q.f, original: q.t, translation: q.tr, excerpt: q.e === 1 })),
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
