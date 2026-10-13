// Letture dell'archivio: quali giorni hanno voci, cronologia a pagine, anteprime.

import { compareEntries } from './entries.js';
import { daysInMonth } from './dates.js';
import { toPlainText } from './markdown.js';

/** Mappa data → numero di voci, per un mese ("AAAA-MM"). */
export function monthDays(db, ym) {
  const from = `${ym}-01`;
  const to = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  return new Promise((resolve, reject) => {
    const req = db.transaction('entries').objectStore('entries').index('date').getAll(IDBKeyRange.bound(from, to));
    req.onsuccess = () => {
      const days = new Map();
      for (const e of req.result) days.set(e.date, (days.get(e.date) ?? 0) + 1);
      resolve(days);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Giorni con voci, dal più recente. `before`: ultima data già mostrata (esclusa), per caricare altri giorni.
 * Restituisce { days: [{ date, entries }], hasMore }.
 */
export function listDays(db, { before = null, limit = 30 } = {}) {
  return new Promise((resolve, reject) => {
    const index = db.transaction('entries').objectStore('entries').index('date');
    const range = before ? IDBKeyRange.upperBound(before, true) : null;
    const days = [];
    let current = null;
    const done = (hasMore) => {
      for (const d of days) d.entries.sort(compareEntries);
      resolve({ days, hasMore });
    };
    const req = index.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return done(false);
      const entry = cursor.value;
      if (!current || current.date !== entry.date) {
        if (days.length >= limit) return done(true);
        current = { date: entry.date, entries: [] };
        days.push(current);
      }
      current.entries.push(entry);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Prime righe di testo di un giorno, per l'anteprima nella cronologia. */
export function dayPreview(entries, max = 150) {
  const text = entries
    .map((e) => toPlainText(e.content).replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
