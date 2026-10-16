// Obiettivi. Un obiettivo ha un orizzonte (giorno, settimana, mese, anno), il suo periodo, uno stato,
// un genitore facoltativo (la cascata), una nota e, dopo la chiusura guidata, una riga di riflessione.
//
// { id, title, horizon, start, end, status, parentId, note, closure, createdAt, updatedAt }
//   status:  'da_fare' | 'fatto' | 'non_riuscito' | 'rimandato'
//   closure: null | { outcome: 'fatto' | 'non_riuscito' | 'rimandato', reflection, date }
//
// Lo stato è quello di adesso e si può cambiare quando si vuole; `closure` è il ricordo di come è andata
// quando si è chiuso il periodo: cambiare lo stato non lo cancella mai.

import { get, getAll, getAllByIndex, put, update } from './db.js';
import { isValidDateStr, todayStr } from './dates.js';
import { needsClosure } from './goals-policy.js';
import { canBeParent, isHorizon, periodFor, rank, shiftPeriod } from './periods.js';
import { nowIso, uuid } from './util.js';

export const STATUSES = ['da_fare', 'fatto', 'non_riuscito', 'rimandato'];
export const OUTCOMES = ['fatto', 'non_riuscito', 'rimandato'];
export const STATUS_LABEL = { da_fare: 'Da fare', fatto: 'Fatto', non_riuscito: 'Non riuscito', rimandato: 'Rimandato' };
export const TITLE_MAX = 200;
export const NOTE_MAX = 2000;
export const REFLECTION_MAX = 1000;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Controlla un obiettivo (anche quelli di un file di backup). Restituisce i problemi trovati. */
export function checkGoal(g) {
  if (!isObject(g)) return ['non è un obiettivo valido'];
  const problems = [];
  if (typeof g.id !== 'string' || !g.id) problems.push('manca l’identificativo');
  if (typeof g.title !== 'string' || !g.title.trim() || g.title.length > TITLE_MAX) problems.push('titolo non valido');
  if (!isHorizon(g.horizon)) {
    problems.push('orizzonte non valido');
  } else if (!isValidDateStr(g.start) || !isValidDateStr(g.end)) {
    problems.push('date non valide');
  } else {
    const p = periodFor(g.horizon, g.start);
    if (p.start !== g.start || p.end !== g.end) problems.push('il periodo non corrisponde all’orizzonte');
  }
  if (!STATUSES.includes(g.status)) problems.push('stato non valido');
  if (g.parentId !== null && (typeof g.parentId !== 'string' || !g.parentId)) problems.push('genitore non valido');
  if (g.parentId !== null && g.parentId === g.id) problems.push('un obiettivo non può essere genitore di sé stesso');
  if (typeof g.note !== 'string' || g.note.length > NOTE_MAX) problems.push('nota non valida');
  if (g.closure !== null) {
    const c = g.closure;
    const ok = isObject(c) && OUTCOMES.includes(c.outcome) && typeof c.reflection === 'string' && c.reflection.length <= REFLECTION_MAX && isValidDateStr(c.date);
    if (!ok) problems.push('chiusura non valida');
  }
  if (typeof g.createdAt !== 'string' || typeof g.updatedAt !== 'string') problems.push('mancano le date di creazione o modifica');
  return problems;
}

/** Controlla che i genitori indicati esistano e rispettino le regole della cascata. */
export function checkGoalTree(goals) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const problems = [];
  for (const g of goals) {
    if (g.parentId === null) continue;
    const parent = byId.get(g.parentId);
    if (!parent) problems.push(`"${g.title}": il genitore non c’è nel file`);
    else if (!canBeParent(g, parent)) problems.push(`"${g.title}": il genitore non è di un orizzonte più lungo che contiene il suo periodo`);
  }
  return problems;
}

const cleanTitle = (title) => String(title ?? '').trim().replace(/\s+/g, ' ');

async function parentFor(db, parentId, child) {
  if (parentId === null || parentId === undefined) return null;
  const parent = await get(db, 'goals', parentId);
  if (!parent) throw new Error('Il genitore non esiste più.');
  if (!canBeParent(child, parent)) throw new Error('Questo genitore non può contenere l’obiettivo.');
  return parent.id;
}

/** Crea un obiettivo. `date` è un giorno qualsiasi del periodo scelto. */
export async function createGoal(db, { title, horizon, date, parentId = null, note = '' }, now = new Date()) {
  const clean = cleanTitle(title);
  if (!clean) throw new Error('Scrivi un titolo.');
  if (clean.length > TITLE_MAX) throw new Error('Il titolo è troppo lungo.');
  if (!isHorizon(horizon)) throw new Error(`Orizzonte non valido: ${horizon}`);
  if (!isValidDateStr(date)) throw new Error(`Data non valida: ${date}`);
  const { start, end } = periodFor(horizon, date);
  const stamp = nowIso(now);
  const goal = {
    id: uuid(),
    title: clean,
    horizon,
    start,
    end,
    status: 'da_fare',
    parentId: await parentFor(db, parentId, { horizon, start }),
    note: String(note ?? '').trim(),
    closure: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  return put(db, 'goals', goal);
}

export const getGoal = (db, id) => get(db, 'goals', id);

/** Cambia titolo, nota, stato e/o genitore. L'orizzonte e il periodo non si cambiano. */
export async function updateGoal(db, id, patch, now = new Date()) {
  const current = await get(db, 'goals', id);
  if (!current) throw new Error('Obiettivo non trovato.');
  const next = { ...current, updatedAt: nowIso(now) };
  if ('title' in patch) {
    next.title = cleanTitle(patch.title);
    if (!next.title) throw new Error('Scrivi un titolo.');
    if (next.title.length > TITLE_MAX) throw new Error('Il titolo è troppo lungo.');
  }
  if ('note' in patch) next.note = String(patch.note ?? '').trim();
  if ('status' in patch) {
    if (!STATUSES.includes(patch.status)) throw new Error(`Stato non valido: ${patch.status}`);
    next.status = patch.status;
  }
  if ('parentId' in patch) next.parentId = await parentFor(db, patch.parentId, current);
  if (checkGoal(next).length) throw new Error(checkGoal(next)[0]);
  return update(db, 'goals', id, (old) => {
    if (!old) throw new Error('Obiettivo non trovato.');
    return { ...next, createdAt: old.createdAt };
  });
}

/** La spunta: da fare ↔ fatto (da qualunque altro stato si passa a «fatto»). */
export async function toggleDone(db, id, now = new Date()) {
  const goal = await get(db, 'goals', id);
  if (!goal) throw new Error('Obiettivo non trovato.');
  return updateGoal(db, id, { status: goal.status === 'fatto' ? 'da_fare' : 'fatto' }, now);
}

/**
 * Rimanda un obiettivo: lo SPOSTA al periodo successivo (il giorno dopo, la settimana dopo…). Sparisce dal periodo
 * di prima e torna «da fare». Il genitore si tiene solo se contiene anche il nuovo periodo; i sotto-obiettivi che
 * non ci stanno più dentro restano senza genitore. Tutto in una sola transazione.
 * `closure` (facoltativo) è la chiusura da ricordare. Restituisce { goal, detached }.
 */
export function postponeGoal(db, id, { closure = null } = {}, now = new Date()) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    const store = tx.objectStore('goals');
    let outcome;
    let failure = null;
    const fail = (message) => {
      failure = new Error(message);
      tx.abort();
    };
    store.get(id).onsuccess = (e) => {
      const goal = e.target.result;
      if (!goal) return fail('Obiettivo non trovato.');
      const next = shiftPeriod(goal.horizon, goal.start, 1);
      const moved = { ...goal, start: next.start, end: next.end, status: 'da_fare', updatedAt: nowIso(now) };
      if (closure) moved.closure = closure;
      const finish = (parent) => {
        moved.parentId = parent && canBeParent(moved, parent) ? parent.id : null;
        store.index('parentId').getAll(id).onsuccess = (ev) => {
          let detached = 0;
          for (const child of ev.target.result) {
            if (canBeParent(child, moved)) continue;
            store.put({ ...child, parentId: null, updatedAt: nowIso(now) });
            detached++;
          }
          store.put(moved);
          outcome = { goal: moved, detached };
        };
      };
      if (goal.parentId) store.get(goal.parentId).onsuccess = (ev) => finish(ev.target.result ?? null);
      else finish(null);
    };
    tx.oncomplete = () => resolve(outcome);
    tx.onerror = () => reject(failure ?? tx.error);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Transazione annullata.'));
  });
}

/**
 * Chiusura guidata: com'è andata (+ una riga facoltativa). Lo stato diventa l'esito.
 * Con esito «rimandato» l'obiettivo si sposta al periodo successivo (vedi postponeGoal) e si ricorda com'è andata.
 * Restituisce { goal, moved, detached }.
 */
export async function closeGoal(db, id, { outcome, reflection = '' }, now = new Date()) {
  if (!OUTCOMES.includes(outcome)) throw new Error(`Esito non valido: ${outcome}`);
  const closure = { outcome, reflection: String(reflection ?? '').trim().slice(0, REFLECTION_MAX), date: todayStr(now) };
  if (outcome === 'rimandato') {
    const { goal, detached } = await postponeGoal(db, id, { closure }, now);
    return { goal, moved: true, detached };
  }
  const goal = await update(db, 'goals', id, (old) => {
    if (!old) throw new Error('Obiettivo non trovato.');
    return { ...old, status: outcome, closure, updatedAt: nowIso(now) };
  });
  return { goal, moved: false, detached: 0 };
}

/**
 * Elimina un obiettivo. I sotto-obiettivi NON vengono eliminati: restano, senza genitore.
 * Restituisce quanti sotto-obiettivi sono rimasti senza genitore.
 */
export function deleteGoal(db, id, now = new Date()) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['goals', 'goalLinks'], 'readwrite');
    const goals = tx.objectStore('goals');
    const links = tx.objectStore('goalLinks');
    let detached = 0;
    const children = goals.index('parentId').getAll(id);
    children.onsuccess = () => {
      for (const child of children.result) {
        goals.put({ ...child, parentId: null, updatedAt: nowIso(now) });
        detached++;
      }
      goals.delete(id);
      const linkKeys = links.index('goalId').getAllKeys(id);
      linkKeys.onsuccess = () => linkKeys.result.forEach((key) => links.delete(key));
    };
    tx.oncomplete = () => resolve(detached);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata.'));
  });
}

const byCreation = (a, b) => a.createdAt.localeCompare(b.createdAt);

/** Gli obiettivi di un periodo (`start` = primo giorno del periodo). */
export async function listGoalsForPeriod(db, horizon, start) {
  const all = await getAllByIndex(db, 'goals', 'horizon', horizon);
  return all.filter((g) => g.start === start).sort(byCreation);
}

/** Gli obiettivi dei singoli giorni tra `start` e `end` (estremi compresi), in ordine di giorno. */
export async function listDayGoalsBetween(db, start, end) {
  const all = await getAllByIndex(db, 'goals', 'horizon', 'giorno');
  return all.filter((g) => g.start >= start && g.start <= end).sort((a, b) => a.start.localeCompare(b.start) || byCreation(a, b));
}

export async function listChildren(db, parentId) {
  const kids = await getAllByIndex(db, 'goals', 'parentId', parentId);
  return kids.sort((a, b) => rank(b.horizon) - rank(a.horizon) || a.start.localeCompare(b.start) || byCreation(a, b));
}

/** Per la striscia di una pagina del giorno: gli obiettivi di quel giorno e della sua settimana. */
export async function listForDayStrip(db, date) {
  const week = periodFor('settimana', date);
  const [day, wk] = await Promise.all([listGoalsForPeriod(db, 'giorno', date), listGoalsForPeriod(db, 'settimana', week.start)]);
  return { day, week: wk };
}

/** Obiettivi per cui proporre la chiusura (vedi goals-policy.js): prima i periodi più lunghi, poi i più recenti. */
export async function listPendingClosure(db, today, policy) {
  const all = await getAll(db, 'goals');
  return all
    .filter((g) => needsClosure(g, today, policy))
    .sort((a, b) => rank(b.horizon) - rank(a.horizon) || b.end.localeCompare(a.end) || byCreation(a, b));
}

/** Possibili genitori per un obiettivo che comincia in `start` con orizzonte `horizon`. */
export async function listParentCandidates(db, horizon, start) {
  const all = await getAll(db, 'goals');
  return all
    .filter((g) => canBeParent({ horizon, start }, g))
    .sort((a, b) => rank(b.horizon) - rank(a.horizon) || byCreation(a, b));
}

/** Riepilogo descrittivo dei sotto-obiettivi: { fatto: 2, da_fare: 1, … }. Niente punteggi. */
export function countByStatus(goals) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of goals) counts[g.status]++;
  return counts;
}
