// Schema del database e migrazioni.
//
// La versione di IndexedDB coincide con lo schemaVersion del diario.
// Ogni migrazione ha:
//   version      numero progressivo (1, 2, 3, ...)
//   up(db, tx)   modifica la struttura (e i dati) dentro la transazione di aggiornamento
//   migrateData  (opzionale) porta un export JSON vecchio alla struttura di questa versione
//
// Regola d'oro: una migrazione non deve MAI perdere dati. Quando se ne aggiunge una,
// STORES va aggiornato, ma la migrazione precedente resta com'è (non si riscrive la storia).

// Struttura della versione 1: congelata, non modificare.
const V1_STORES = {
  // Fase 1: usati davvero
  entries: { keyPath: 'id', indexes: { date: 'date' } },
  settings: { keyPath: 'id', indexes: {} },
  // Fasi successive: creati vuoti, pronti ad accogliere i dati
  days: { keyPath: 'date', indexes: {} },
  moduleDefs: { keyPath: 'id', indexes: {} },
  moduleInstances: { keyPath: 'id', indexes: { entryId: 'entryId', date: 'date' } },
  goals: { keyPath: 'id', indexes: { parentId: 'parentId', horizon: 'horizon' } },
  goalLinks: { keyPath: 'id', indexes: { goalId: 'goalId', entryId: 'entryId' } },
};

function createStores(db, stores) {
  for (const [name, def] of Object.entries(stores)) {
    const os = db.createObjectStore(name, { keyPath: def.keyPath });
    for (const [indexName, keyPath] of Object.entries(def.indexes)) {
      os.createIndex(indexName, keyPath, { unique: false });
    }
  }
}

export const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      createStores(db, V1_STORES);
    },
    migrateData(data) {
      return data;
    },
  },
];

/** Struttura attuale (ultima versione): serve a export e import. */
export const STORES = V1_STORES;

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function latestVersion(migrations = MIGRATIONS) {
  return migrations[migrations.length - 1].version;
}

/** Applica, in ordine, le migrazioni successive alla versione `oldVersion`. */
export function runMigrations(db, tx, oldVersion, migrations = MIGRATIONS) {
  for (const m of migrations) {
    if (m.version > oldVersion) m.up(db, tx);
  }
}

/** Porta i dati di un export di versione `fromVersion` all'ultima struttura. */
export function migrateData(data, fromVersion, migrations = MIGRATIONS) {
  let out = data;
  for (const m of migrations) {
    if (m.version > fromVersion && m.migrateData) out = m.migrateData(out);
  }
  return out;
}
