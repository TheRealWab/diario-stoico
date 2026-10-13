// Voci del diario. Più voci per giorno; il contenuto è Markdown (vedi markdown.js).

import { getAllByIndex, put, remove, update } from './db.js';
import { isValidDateStr, isValidTimeStr } from './dates.js';
import { nowIso, uuid } from './util.js';

export const LABELS = ['mattina', 'giorno', 'sera']; // l'assenza di etichetta è null

function checkLabel(label) {
  if (label !== null && !LABELS.includes(label)) throw new Error(`Etichetta non valida: ${label}`);
}

export async function createEntry(db, { date, time, label = null, content = '' }, now = new Date()) {
  if (!isValidDateStr(date)) throw new Error(`Data non valida: ${date}`);
  if (!isValidTimeStr(time)) throw new Error(`Ora non valida: ${time}`);
  checkLabel(label);
  const stamp = nowIso(now);
  const entry = { id: uuid(), date, time, label, content, createdAt: stamp, updatedAt: stamp };
  return put(db, 'entries', entry);
}

export function compareEntries(a, b) {
  return a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt);
}

export async function listEntriesForDay(db, date) {
  const entries = await getAllByIndex(db, 'entries', 'date', date);
  return entries.sort(compareEntries);
}

/** Aggiorna contenuto e/o etichetta di una voce. */
export async function updateEntry(db, id, patch, now = new Date()) {
  if ('label' in patch) checkLabel(patch.label);
  if ('content' in patch && typeof patch.content !== 'string') throw new Error('Contenuto non valido.');
  const saved = await update(db, 'entries', id, (old) => {
    if (!old) throw new Error('Voce non trovata.');
    const next = { ...old, updatedAt: nowIso(now) };
    if ('content' in patch) next.content = patch.content;
    if ('label' in patch) next.label = patch.label;
    return next;
  });
  return saved;
}

export function deleteEntry(db, id) {
  return remove(db, 'entries', id);
}
