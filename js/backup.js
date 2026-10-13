// Export e import JSON di tutto il diario.
//
// Formato del file:
//   { app: "diario-stoico", schemaVersion, exportedAt, data: { entries: [...], settings: [...], ... } }

import { getAll, txDone } from './db.js';
import { MIGRATIONS, SCHEMA_VERSION, STORES, migrateData } from './migrations.js';
import { LABELS } from './entries.js';
import { checkSettings, saveSettings } from './settings.js';
import { isValidDateStr, isValidTimeStr, todayStr } from './dates.js';
import { APP_ID } from './util.js';

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;

export function exportFilename(now = new Date()) {
  return `diario-stoico-${todayStr(now)}.json`;
}

/**
 * Raccoglie tutti i dati. Segna prima il backup come fatto oggi, così anche il file
 * contiene la data giusta e, reimportandolo, tutto torna identico.
 */
export async function buildExport(db, now = new Date()) {
  await saveSettings(db, { lastBackupDate: todayStr(now) }, now);
  const data = {};
  for (const store of Object.keys(STORES)) data[store] = await getAll(db, store);
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

function checkEntry(e, where) {
  const errors = [];
  if (!isObject(e)) return [`${where}: non è una voce valida.`];
  if (!isText(e.id)) errors.push(`${where}: manca l'identificativo.`);
  if (!isValidDateStr(e.date)) errors.push(`${where}: data non valida (${e.date}).`);
  if (!isValidTimeStr(e.time)) errors.push(`${where}: ora non valida (${e.time}).`);
  if (e.label !== null && !LABELS.includes(e.label)) errors.push(`${where}: etichetta non valida.`);
  if (typeof e.content !== 'string') errors.push(`${where}: contenuto non valido.`);
  if (!isText(e.createdAt) || !isText(e.updatedAt)) errors.push(`${where}: mancano le date di creazione o modifica.`);
  return errors;
}

/**
 * Controlla un file già letto con JSON.parse. Non tocca nulla.
 * Restituisce { ok, errors, data, summary }; `data` è già portata all'ultima struttura.
 */
export function validateImport(file, migrations = MIGRATIONS) {
  const errors = [];
  const fail = () => ({ ok: false, errors, data: null, summary: null });

  if (!isObject(file)) {
    errors.push('Il file non ha il formato di un backup del diario.');
    return fail();
  }
  if (file.app !== APP_ID) errors.push('Il file non è un backup di Diario Stoico.');
  if (!Number.isInteger(file.schemaVersion) || file.schemaVersion < 1) {
    errors.push('Versione del backup mancante o non valida.');
  } else if (file.schemaVersion > Math.max(...migrations.map((m) => m.version))) {
    errors.push("Il backup è stato creato da una versione più recente dell'app: aggiorna l'app prima di importarlo.");
  }
  if (!isObject(file.data)) errors.push('Nel file mancano i dati.');
  if (errors.length) return fail();

  for (const store of Object.keys(STORES)) {
    if (store in file.data && !Array.isArray(file.data[store])) {
      errors.push(`Sezione "${store}" non valida.`);
    }
  }
  if (errors.length) return fail();

  const data = migrateData(file.data, file.schemaVersion, migrations);
  const clean = {};
  for (const [store, def] of Object.entries(STORES)) {
    const records = data[store] ?? [];
    const seen = new Set();
    records.forEach((rec, i) => {
      const where = `${store} n. ${i + 1}`;
      if (!isObject(rec) || !isText(rec[def.keyPath]) || (store === 'days' && !isValidDateStr(rec.date))) {
        errors.push(`${where}: record non valido.`);
        return;
      }
      if (seen.has(rec[def.keyPath])) errors.push(`${where}: identificativo duplicato.`);
      seen.add(rec[def.keyPath]);
      if (store === 'entries') errors.push(...checkEntry(rec, where));
      if (store === 'settings') errors.push(...checkSettings(rec).map((p) => `${where}: ${p}`));
    });
    clean[store] = records;
  }
  if (errors.length) return fail();

  const dates = clean.entries.map((e) => e.date).sort();
  const summary = {
    schemaVersion: file.schemaVersion,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : null,
    counts: Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v.length])),
    entries: { count: dates.length, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null },
  };
  return { ok: true, errors, data: clean, summary };
}

/** Anteprima di "unisci": quante voci sono nuove, aggiornate o già presenti. Non scrive nulla. */
export async function planMerge(db, data) {
  const existing = new Map((await getAll(db, 'entries')).map((e) => [e.id, e]));
  const plan = { added: 0, updated: 0, unchanged: 0 };
  for (const e of data.entries) {
    const cur = existing.get(e.id);
    if (!cur) plan.added++;
    else if (e.updatedAt > cur.updatedAt) plan.updated++;
    else plan.unchanged++;
  }
  return plan;
}

/**
 * Importa dati già validati, in un'unica transazione: o va tutto, o non cambia niente.
 *   replace: cancella ciò che c'è e mette i dati del file
 *   merge:   aggiunge i record nuovi; se esiste già, vince il più recente (updatedAt);
 *            le impostazioni attuali non vengono toccate
 */
export async function importData(db, data, mode) {
  if (mode !== 'replace' && mode !== 'merge') throw new Error(`Modalità non valida: ${mode}`);
  const names = Object.keys(STORES);
  const tx = db.transaction(names, 'readwrite');
  const done = txDone(tx);
  const result = { added: 0, updated: 0, kept: 0 };

  try {
    for (const [store, def] of Object.entries(STORES)) {
      const os = tx.objectStore(store);
      const records = data[store] ?? [];
      if (mode === 'replace') {
        os.clear();
        for (const rec of records) os.put(rec);
        result.added += records.length;
        continue;
      }
      for (const rec of records) {
        const req = os.get(rec[def.keyPath]);
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) {
            os.put(rec);
            result.added++;
          } else if (store !== 'settings' && rec.updatedAt > cur.updatedAt) {
            os.put(rec);
            result.updated++;
          } else {
            result.kept++;
          }
        };
      }
    }
  } catch (err) {
    // Un errore a metà strada deve lasciare i dati com'erano.
    tx.abort();
    await done.catch(() => {});
    throw err;
  }
  await done;
  return result;
}

/** Fa scaricare il file (solo nel browser). */
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
