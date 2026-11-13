// Letture dell'archivio: in quali giorni hai scritto (voci o moduli), cronologia a pagine, anteprime.

import { compareEntries, isEmptyEntry } from './entries.js';
import { daysInMonth } from './dates.js';
import { getAll } from './db.js';
import { toPlainText } from './markdown.js';
import { dataText, isEmptyData, listAllDefs } from './modules.js';

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/**
 * I moduli con qualcosa di scritto, tra le righe lette dal database: [{ def, instance }], nell'ordine dei moduli.
 * Il tipo di un modulo sta nella sua definizione (anche archiviata), non nei dati: per questo servono le definizioni.
 */
async function writtenModules(db, rows) {
  if (!rows.length) return [];
  const defs = await listAllDefs(db, { includeArchived: true });
  const order = new Map(defs.map((d, i) => [d.id, i]));
  const byId = new Map(defs.map((d) => [d.id, d]));
  return rows
    .map((instance) => ({ def: byId.get(instance.moduleId), instance }))
    .filter((m) => m.def && !isEmptyData(m.def.type, m.instance.data))
    .sort((a, b) => order.get(a.def.id) - order.get(b.def.id));
}

/**
 * Per un mese ("AAAA-MM"): Map data → { entries, modules }, cioè quante voci e quanti moduli hai scritto quel giorno.
 * I giorni senza niente di scritto non ci sono; le voci vuote non contano.
 */
export async function monthDays(db, ym) {
  const range = IDBKeyRange.bound(`${ym}-01`, `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`);
  const tx = db.transaction(['entries', 'moduleInstances']);
  const [entries, rows] = await Promise.all(['entries', 'moduleInstances'].map((store) => wrap(tx.objectStore(store).index('date').getAll(range))));
  const days = new Map();
  const day = (date) => days.get(date) ?? days.set(date, { entries: 0, modules: 0 }).get(date);
  for (const e of entries) if (!isEmptyEntry(e)) day(e.date).entries++;
  for (const m of await writtenModules(db, rows)) day(m.instance.date).modules++;
  return new Map([...days].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Giorni in cui hai scritto, dal più recente. `before`: ultima data già mostrata (esclusa), per caricare altri giorni.
 * Restituisce { days: [{ date, entries, modules }], hasMore }.
 * Legge tutto il diario e poi taglia: sono testi brevi, e così un giorno con soli moduli sta al suo posto tra gli altri.
 */
export async function listDays(db, { before = null, limit = 30 } = {}) {
  const [entries, rows] = await Promise.all([getAll(db, 'entries'), getAll(db, 'moduleInstances')]);
  const byDate = new Map();
  const day = (date) => byDate.get(date) ?? byDate.set(date, { date, entries: [], modules: [] }).get(date);
  for (const e of entries) if (!isEmptyEntry(e)) day(e.date).entries.push(e);
  for (const m of await writtenModules(db, rows)) day(m.instance.date).modules.push(m);
  const all = [...byDate.values()].filter((d) => !before || d.date < before).sort((a, b) => b.date.localeCompare(a.date));
  const days = all.slice(0, limit);
  for (const d of days) d.entries.sort(compareEntries);
  return { days, hasMore: all.length > days.length };
}

/** Il giorno più lontano in cui hai scritto qualcosa (voce o modulo), oppure null se il diario è vuoto. */
export async function firstWrittenDate(db) {
  const tx = db.transaction(['entries', 'moduleInstances']);
  const first = (store) => wrap(tx.objectStore(store).index('date').openKeyCursor()).then((cursor) => cursor?.key ?? null);
  const dates = (await Promise.all([first('entries'), first('moduleInstances')])).filter(Boolean).sort();
  return dates[0] ?? null;
}

const oneLine = (text) => text.replace(/\s*\n\s*/g, ' ').trim();

/**
 * Prime righe di testo di un giorno, per l'anteprima nella cronologia: prima le voci, poi i moduli («Nome: testo»;
 * solo il nome se il modulo non ha parole, come l'umore).
 */
export function dayPreview(entries, max = 150, modules = []) {
  const text = [
    ...entries.map((e) => oneLine(toPlainText(e.content))),
    ...modules.map(({ def, instance }) => {
      const words = dataText(def.type, instance.data).split('\n').map(oneLine).join('; '); // le risposte di un modulo, una dopo l'altra
      return words ? `${def.name}: ${words}` : def.name;
    }),
  ]
    .filter(Boolean)
    .join(' · ');
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** «2 voci · 1 modulo»: quanto c'è di scritto in un giorno, a parole. */
export function writtenLabel({ entries = 0, modules = 0 }, separator = ' · ') {
  const parts = [];
  if (entries) parts.push(`${entries} ${entries === 1 ? 'voce' : 'voci'}`);
  if (modules) parts.push(`${modules} ${modules === 1 ? 'modulo' : 'moduli'}`);
  return parts.join(separator);
}
