// Moduli: quali ci sono, quali compaiono in un giorno e i dati che l'utente ci scrive.
//
// Tre cose stanno nel database:
//   moduleDefs       i moduli creati dall'utente (quelli già pronti vivono nel catalogo, vedi modules-catalog.js)
//   days             per un giorno: quali moduli ha AGGIUNTO e quali ha NASCOSTO { date, added, hidden, updatedAt }
//   moduleInstances  i dati di un modulo in un giorno. Uno per giorno e modulo: id = "AAAA-MM-GG|idModulo"
//
// Regola d'oro: nascondere o archiviare non cancella MAI i dati. Un modulo è visibile in un giorno se
//   (è attivo di base nelle impostazioni  O  è stato aggiunto in quel giorno)  E  non è stato nascosto in quel giorno.

import { get, getAll, getAllByIndex, put, update } from './db.js';
import { isValidDateStr } from './dates.js';
import { BUILTIN_MODULES, CUSTOM_TYPES, EVENING_VARIANTS, LIMITS, NO_DATA_TYPES, VIRTUES, isBuiltinId } from './modules-catalog.js';
import { getSettings, saveSettings } from './settings.js';
import { nowIso, uuid } from './util.js';

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;

export const instanceId = (date, moduleId) => `${date}|${moduleId}`;

// ---------- forma dei dati di ogni tipo ----------

const str = (v, max = LIMITS.text) => (typeof v === 'string' ? v.slice(0, max) : '');
const level = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
const known = (list, ids) => (Array.isArray(ids) ? [...new Set(ids.filter((id) => list.includes(id)))] : []);
const VIRTUE_IDS = VIRTUES.map((v) => v.id);
const EVENING_IDS = EVENING_VARIANTS.map((v) => v.id);

/** I dati vuoti di un tipo di modulo. */
export function defaultData(type) {
  return normalizeData(type, {});
}

/**
 * Porta qualunque cosa (anche dati vecchi, incompleti o importati) alla forma giusta del tipo, con i limiti di lunghezza.
 * Chi disegna un modulo parte sempre da qui: non può trovare campi mancanti o di tipo sbagliato.
 */
export function normalizeData(type, data) {
  const d = isObject(data) ? data : {};
  switch (type) {
    case 'text':
      return { text: str(d.text) };
    case 'checklist':
      return {
        items: (Array.isArray(d.items) ? d.items : [])
          .filter((i) => isObject(i) && typeof i.text === 'string' && i.text.trim())
          .slice(0, LIMITS.itemsMax)
          .map((i) => ({ text: str(i.text, LIMITS.line), done: i.done === true })),
      };
    case 'rating':
    case 'choice':
      return type === 'rating' ? { value: level(d.value) } : { value: typeof d.value === 'string' && d.value ? d.value.slice(0, LIMITS.option) : null };
    case 'premeditatio': {
      const cases = (Array.isArray(d.cases) ? d.cases : [])
        .filter(isObject)
        .slice(0, LIMITS.casesMax)
        .map((c) => ({ event: str(c.event, LIMITS.line), response: str(c.response, LIMITS.line) }));
      return { cases: cases.length ? cases : [{ event: '', response: '' }] };
    }
    case 'negvis':
      return { imagine: str(d.imagine), appreciate: str(d.appreciate) };
    case 'virtues':
      return { exercised: known(VIRTUE_IDS, d.exercised), missed: known(VIRTUE_IDS, d.missed), note: str(d.note) };
    case 'control':
      return { episode: str(d.episode, LIMITS.line), mine: str(d.mine), notmine: str(d.notmine) };
    case 'mood':
      return { mood: level(d.mood), energy: level(d.energy) };
    case 'evening': {
      const answers = Array.isArray(d.answers) ? d.answers : [];
      return {
        variant: EVENING_IDS.includes(d.variant) ? d.variant : EVENING_IDS[0],
        answers: [0, 1, 2].map((i) => str(answers[i])),
      };
    }
    default:
      return {};
  }
}

/** Il modulo è vuoto (nessuno ha scritto o scelto niente)? Un'istanza vuota non si crea nemmeno. */
export function isEmptyData(type, data) {
  const d = normalizeData(type, data);
  switch (type) {
    case 'text':
      return !d.text.trim();
    case 'checklist':
      return d.items.length === 0;
    case 'rating':
    case 'choice':
      return d.value === null;
    case 'premeditatio':
      return d.cases.every((c) => !c.event.trim() && !c.response.trim());
    case 'negvis':
      return !d.imagine.trim() && !d.appreciate.trim();
    case 'virtues':
      return !d.exercised.length && !d.missed.length && !d.note.trim();
    case 'control':
      return !d.episode.trim() && !d.mine.trim() && !d.notmine.trim();
    case 'mood':
      return d.mood === null && d.energy === null;
    case 'evening':
      return d.answers.every((a) => !a.trim());
    default:
      return true;
  }
}

// ---------- controlli (anche per i backup) ----------

export function checkModuleDef(def) {
  if (!isObject(def)) return ['non è un modulo valido'];
  const problems = [];
  if (!isText(def.id) || isBuiltinId(def.id)) problems.push('identificativo non valido');
  if (typeof def.name !== 'string' || !def.name.trim() || def.name.length > LIMITS.name) problems.push('nome non valido');
  if (typeof def.prompt !== 'string' || def.prompt.length > LIMITS.prompt) problems.push('frase-guida non valida');
  if (!CUSTOM_TYPES.includes(def.type)) problems.push('tipo non valido');
  const opts = def.options;
  if (!Array.isArray(opts) || opts.some((o) => typeof o !== 'string' || !o.trim() || o.length > LIMITS.option) || new Set(opts).size !== opts.length) {
    problems.push('opzioni non valide');
  } else if (def.type === 'choice' ? opts.length < 2 || opts.length > LIMITS.optionsMax : opts.length !== 0) {
    problems.push('numero di opzioni non valido');
  }
  if (typeof def.archived !== 'boolean') problems.push('stato di archivio non valido');
  if (typeof def.createdAt !== 'string' || typeof def.updatedAt !== 'string') problems.push('mancano le date di creazione o modifica');
  return problems;
}

export function checkModuleInstance(inst) {
  if (!isObject(inst)) return ['non sono dati di un modulo validi'];
  const problems = [];
  if (!isValidDateStr(inst.date)) problems.push('data non valida');
  if (!isText(inst.moduleId)) problems.push('manca il modulo');
  if (inst.id !== instanceId(inst.date, inst.moduleId)) problems.push('identificativo non coerente');
  if (!isObject(inst.data)) problems.push('dati non validi');
  else if (JSON.stringify(inst.data).length > LIMITS.dataBytes) problems.push('dati troppo grandi');
  if (typeof inst.createdAt !== 'string' || typeof inst.updatedAt !== 'string') problems.push('mancano le date di creazione o modifica');
  return problems;
}

export function checkDayRecord(day) {
  if (!isObject(day)) return ['non è un giorno valido'];
  const problems = [];
  if (!isValidDateStr(day.date)) problems.push('data non valida');
  for (const key of ['added', 'hidden']) {
    if (!Array.isArray(day[key]) || day[key].some((id) => !isText(id)) || day[key].length > 200) problems.push(`elenco "${key}" non valido`);
  }
  if (typeof day.updatedAt !== 'string') problems.push('manca la data di modifica');
  return problems;
}

// ---------- elenco dei moduli ----------

/** Un modulo creato dall'utente, nella stessa forma di quelli già pronti. */
const customToDef = (rec) => ({ ...rec, builtin: false, blurb: rec.prompt });

export async function listCustomDefs(db, { includeArchived = false } = {}) {
  const all = (await getAll(db, 'moduleDefs')).filter((d) => CUSTOM_TYPES.includes(d.type));
  return all
    .filter((d) => includeArchived || !d.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(customToDef);
}

/** Tutti i moduli, nell'ordine della pagina: prima quelli già pronti (sopra le voci, poi sotto), poi i tuoi (sotto). */
export async function listAllDefs(db, options) {
  const builtin = BUILTIN_MODULES.map((m) => ({ ...m, builtin: true, slot: m.slot }));
  const custom = (await listCustomDefs(db, options)).map((d) => ({ ...d, slot: 'bottom' }));
  return [...builtin.filter((m) => m.slot === 'top'), ...builtin.filter((m) => m.slot === 'bottom'), ...custom];
}

// ---------- ordine nella pagina ----------

/** «Le tue voci» (dove si scrive il diario) è un blocco della pagina come i moduli: si può spostare. */
export const ENTRIES_ID = 'entries';

/** L'ordine di partenza: i moduli sopra le voci, le voci, quelli sotto, poi i tuoi. */
export function defaultOrder(customIds = []) {
  const ids = (slot) => BUILTIN_MODULES.filter((m) => m.slot === slot).map((m) => m.id);
  return [...ids('top'), ENTRIES_ID, ...ids('bottom'), ...customIds];
}

/**
 * L'ordine da usare: quello salvato nelle impostazioni (se c'è), senza ciò che non esiste più e con in coda
 * ciò che non era ancora nella lista (per esempio un modulo creato dopo).
 */
export function resolveOrder(saved, customIds = []) {
  const base = defaultOrder(customIds);
  const head = (Array.isArray(saved) ? saved : []).filter((id, i, all) => base.includes(id) && all.indexOf(id) === i);
  return [...head, ...base.filter((id) => !head.includes(id))];
}

/** Mette i moduli nell'ordine scelto e segna se stanno sopra ('top') o sotto ('bottom') le voci. */
export function orderDefs(defs, saved) {
  const order = resolveOrder(saved, defs.filter((d) => !d.builtin).map((d) => d.id));
  const entriesAt = order.indexOf(ENTRIES_ID);
  const byId = new Map(defs.map((d) => [d.id, d]));
  return order
    .map((id, i) => (byId.has(id) ? { ...byId.get(id), slot: i < entriesAt ? 'top' : 'bottom' } : null))
    .filter(Boolean);
}

/** Sposta un blocco di un posto (-1 su, +1 giù) tra quelli mostrati (`shown` = id visibili nell'elenco, in ordine). */
export function moveInOrder(order, shown, id, step) {
  const at = shown.indexOf(id);
  const other = shown[at + step];
  if (at < 0 || other === undefined) return order;
  const next = [...order];
  const a = next.indexOf(id);
  const b = next.indexOf(other);
  next.splice(a, 1);
  next.splice(b, 0, id); // se il vicino era più avanti, dopo aver tolto il blocco la sua posizione è già scalata di uno
  return next;
}

export async function setModuleOrder(db, order, now) {
  return saveSettings(db, { moduleOrder: order }, now);
}

export async function createCustomDef(db, { name, prompt = '', type, options = [] }, now = new Date()) {
  const clean = {
    id: `c-${uuid()}`,
    name: String(name ?? '').trim().replace(/\s+/g, ' '),
    prompt: String(prompt ?? '').trim(),
    type,
    options: type === 'choice' ? options.map((o) => String(o).trim()).filter(Boolean) : [],
    archived: false,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
  };
  if (!clean.name) throw new Error('Scrivi un nome per il modulo.');
  const problems = checkModuleDef(clean);
  if (problems.length) throw new Error(problems[0][0].toUpperCase() + problems[0].slice(1) + '.');
  await put(db, 'moduleDefs', clean);
  return customToDef(clean);
}

/** Nome e frase-guida si possono cambiare; il tipo e le opzioni no, per non rendere illeggibili i dati già scritti. */
export async function updateCustomDef(db, id, patch, now = new Date()) {
  const old = await get(db, 'moduleDefs', id);
  if (!old) throw new Error('Modulo non trovato.');
  const next = { ...old, updatedAt: nowIso(now) };
  if ('name' in patch) next.name = String(patch.name ?? '').trim().replace(/\s+/g, ' ');
  if ('prompt' in patch) next.prompt = String(patch.prompt ?? '').trim();
  if ('archived' in patch) next.archived = patch.archived === true;
  const problems = checkModuleDef(next);
  if (problems.length) throw new Error(problems[0][0].toUpperCase() + problems[0].slice(1) + '.');
  await put(db, 'moduleDefs', next);
  return customToDef(next);
}

/** Archiviare toglie il modulo dalle liste; i dati restano e si può ripristinare. */
export const archiveCustomDef = (db, id, archived = true, now) => updateCustomDef(db, id, { archived }, now);

// ---------- attivo di base (impostazioni) ----------

/**
 * I moduli attivi di base. Finché non si sceglie nulla nelle impostazioni (`modulesConfigured` falso) vale la situazione di
 * prima dei moduli: c'è solo la striscia degli obiettivi. Dopo la prima scelta vale l'elenco salvato.
 */
export function enabledIds(settings) {
  const saved = Array.isArray(settings?.enabledModules) ? settings.enabledModules : [];
  const ids = new Set(settings?.modulesConfigured === true ? saved : ['goals', ...saved]);
  if (settings?.quoteChosen !== true) ids.add('quote'); // la frase del giorno c'è finché non si sceglie di spegnerla
  return ids;
}

export async function setModuleEnabled(db, id, on, now) {
  const settings = await getSettings(db);
  const ids = enabledIds(settings);
  if (on) ids.add(id);
  else ids.delete(id);
  const patch = { enabledModules: [...ids], modulesConfigured: true };
  if (id === 'quote') patch.quoteChosen = true; // una scelta fatta: da qui in poi vale quella
  return saveSettings(db, patch, now);
}

// ---------- un giorno ----------

export async function getDay(db, date) {
  const rec = await get(db, 'days', date);
  return { date, added: rec?.added ?? [], hidden: rec?.hidden ?? [], updatedAt: rec?.updatedAt ?? null };
}

/** È visibile questo modulo in quel giorno? */
export const isVisible = (id, enabled, day) => (enabled.has(id) || day.added.includes(id)) && !day.hidden.includes(id);

/**
 * Mostra o nasconde un modulo in UN giorno. Non tocca mai i dati del modulo.
 * Si scrive solo ciò che serve: aggiunto se non è attivo di base, nascosto se lo è.
 */
export async function setVisibleForDay(db, date, moduleId, visible, enabled, now = new Date()) {
  if (!isValidDateStr(date)) throw new Error(`Data non valida: ${date}`);
  const day = await getDay(db, date);
  const added = day.added.filter((id) => id !== moduleId);
  const hidden = day.hidden.filter((id) => id !== moduleId);
  if (visible && !enabled.has(moduleId)) added.push(moduleId);
  if (!visible && enabled.has(moduleId)) hidden.push(moduleId);
  return put(db, 'days', { date, added, hidden, updatedAt: nowIso(now) });
}

// ---------- i dati di un modulo in un giorno ----------

export const getInstance = (db, date, moduleId) => get(db, 'moduleInstances', instanceId(date, moduleId));

/** Tutti i dati dei moduli di un giorno: Map(idModulo → istanza). */
export async function listInstancesForDay(db, date) {
  const rows = await getAllByIndex(db, 'moduleInstances', 'date', date);
  return new Map(rows.map((r) => [r.moduleId, r]));
}

/**
 * Salva i dati di un modulo in un giorno (crea o aggiorna). Se non c'è niente di scritto e il modulo non ha ancora
 * dati, non crea nulla. Restituisce l'istanza salvata oppure null.
 */
export async function saveInstance(db, date, moduleId, type, data, now = new Date()) {
  if (!isValidDateStr(date)) throw new Error(`Data non valida: ${date}`);
  if (NO_DATA_TYPES.includes(type)) throw new Error('Questo modulo non ha dati da salvare.');
  const clean = normalizeData(type, data);
  const id = instanceId(date, moduleId);
  let result = null;
  await update(db, 'moduleInstances', id, (old) => {
    if (!old && isEmptyData(type, clean)) return undefined;
    result = { id, date, moduleId, entryId: null, data: clean, createdAt: old?.createdAt ?? nowIso(now), updatedAt: nowIso(now) };
    return result;
  });
  return result;
}

/** Il modulo ha qualcosa di scritto in quel giorno? */
export const hasContent = (def, instance) => !!instance && !isEmptyData(def.type, instance.data);

/**
 * Per una pagina del giorno: i moduli visibili e quelli che si possono aggiungere.
 * `withData` = moduli con qualcosa di scritto (anche se oggi non sono visibili).
 */
export function arrangeForDay(defs, enabled, day, instances) {
  const visible = defs.filter((d) => isVisible(d.id, enabled, day));
  const available = defs.filter((d) => !isVisible(d.id, enabled, day));
  const withData = new Set(defs.filter((d) => hasContent(d, instances.get(d.id))).map((d) => d.id));
  return { visible, available, withData };
}
