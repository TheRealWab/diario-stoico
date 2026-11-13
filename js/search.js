// Ricerca per parola in quello che hai scritto (voci, moduli, obiettivi). Ignora maiuscole e accenti ("perche" trova "perché").
// Solo calcoli sul testo: nessun accesso alla pagina.

import { toPlainText } from './markdown.js';

export const MIN_QUERY_LENGTH = 2;

/**
 * Testo senza accenti e minuscolo, con la corrispondenza tra le posizioni nel testo
 * normalizzato e quelle nel testo originale (servono per evidenziare i risultati).
 */
export function normalizeWithMap(text) {
  let norm = '';
  const starts = [];
  const ends = [];
  let i = 0;
  for (const ch of text) {
    const n = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < n.length; k++) {
      starts.push(i);
      ends.push(i + ch.length);
    }
    norm += n;
    i += ch.length;
  }
  return { norm, starts, ends };
}

export const normalize = (text) => normalizeWithMap(text).norm;

/** Parole da cercare (tutte devono comparire). */
export function tokenize(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/** Zone [da, a) del testo ORIGINALE in cui compare una delle parole, unite se si toccano. */
export function findRanges(text, tokens) {
  const { norm, starts, ends } = normalizeWithMap(text);
  const ranges = [];
  for (const token of tokens) {
    let at = norm.indexOf(token);
    while (at !== -1) {
      ranges.push([starts[at], ends[at + token.length - 1]]);
      at = norm.indexOf(token, at + token.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/**
 * Frase intorno alla prima corrispondenza, a pezzi: [{ text, match }].
 * Il testo è quello semplice (senza simboli Markdown), su una riga.
 */
export function snippet(text, tokens, radius = 70) {
  const flat = text.replace(/\s*\n\s*/g, ' ');
  const ranges = findRanges(flat, tokens);
  if (!ranges.length) return [{ text: flat.slice(0, radius * 2), match: false }];

  let from = Math.max(0, ranges[0][0] - radius);
  let to = Math.min(flat.length, ranges[0][1] + radius);
  // si parte e si finisce a inizio/fine parola
  if (from > 0) {
    const space = flat.indexOf(' ', from);
    if (space !== -1 && space < ranges[0][0]) from = space + 1;
  }
  if (to < flat.length) {
    const space = flat.lastIndexOf(' ', to);
    if (space > ranges[0][1]) to = space;
  }

  const parts = [];
  if (from > 0) parts.push({ text: '… ', match: false });
  let pos = from;
  for (const [a, b] of ranges) {
    if (b <= from || a >= to) continue;
    const start = Math.max(a, from);
    const end = Math.min(b, to);
    if (start > pos) parts.push({ text: flat.slice(pos, start), match: false });
    parts.push({ text: flat.slice(start, end), match: true });
    pos = end;
  }
  if (pos < to) parts.push({ text: flat.slice(pos, to), match: false });
  if (to < flat.length) parts.push({ text: ' …', match: false });
  return parts;
}

/**
 * Cerca in un elenco di testi: [{ text, date, time? , … }] (voci, moduli, obiettivi: vedi views/archive.js).
 * Un elemento risulta se contiene TUTTE le parole (in qualunque ordine). Restituisce { item, parts }, dal più recente.
 */
export function searchItems(items, query, { limit = 100 } = {}) {
  const tokens = tokenize(query);
  if (!tokens.length || query.trim().length < MIN_QUERY_LENGTH) {
    return { results: [], total: 0, tokens };
  }
  const found = items.filter((item) => {
    const norm = normalize(item.text);
    return tokens.every((t) => norm.includes(t));
  });
  found.sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
  const results = found.slice(0, limit).map((item) => ({ item, parts: snippet(item.text, tokens) }));
  return { results, total: found.length, tokens };
}

/** Cerca nelle voci. Restituisce { entry, parts }, dalla più recente. */
export function searchEntries(entries, query, options) {
  const items = entries.map((entry) => ({ entry, text: toPlainText(entry.content), date: entry.date, time: entry.time }));
  const { results, total, tokens } = searchItems(items, query, options);
  return { results: results.map(({ item, parts }) => ({ entry: item.entry, parts })), total, tokens };
}
