// Accesso a IndexedDB: apertura con migrazioni e piccole funzioni di lettura/scrittura.

import { MIGRATIONS, latestVersion, runMigrations } from './migrations.js';

export const DB_NAME = 'diario-stoico';

export function openDb(name = DB_NAME, migrations = MIGRATIONS) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, latestVersion(migrations));
    req.onupgradeneeded = (event) => {
      try {
        runMigrations(req.result, req.transaction, event.oldVersion, migrations);
      } catch (err) {
        // Se una migrazione fallisce si annulla tutto: i dati vecchi restano intatti.
        req.transaction.abort();
        reject(err);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Se un'altra scheda aggiorna lo schema, ci facciamo da parte.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Il database è bloccato da un'altra scheda aperta."));
  });
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Si risolve quando la transazione è stata scritta davvero. */
export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata.'));
  });
}

export const get = (db, store, key) => wrap(db.transaction(store).objectStore(store).get(key));

export const getAll = (db, store) => wrap(db.transaction(store).objectStore(store).getAll());

export const getAllByIndex = (db, store, index, key) =>
  wrap(db.transaction(store).objectStore(store).index(index).getAll(key));

export async function put(db, store, value) {
  const tx = db.transaction(store, 'readwrite');
  const done = txDone(tx);
  tx.objectStore(store).put(value);
  await done;
  return value;
}

export async function remove(db, store, key) {
  const tx = db.transaction(store, 'readwrite');
  const done = txDone(tx);
  tx.objectStore(store).delete(key);
  await done;
}

/**
 * Legge un record, lo trasforma con `fn` e lo riscrive nella stessa transazione
 * (nessun aggiornamento può andare perso). Se il record non esiste, `fn` riceve
 * undefined: restituendo un valore lo crea, restituendo undefined non scrive nulla.
 */
export function update(db, store, key, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    let result;
    const req = os.get(key);
    req.onsuccess = () => {
      result = fn(req.result);
      if (result !== undefined) os.put(result);
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transazione annullata.'));
  });
}
