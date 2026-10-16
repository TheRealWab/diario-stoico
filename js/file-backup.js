// Dove salvare il backup: scelta della cartella e del nome (File System Access API) e sostituzione del file
// scelto la volta prima, così resta un solo backup invece di tanti doppioni. Il "riferimento" al file (handle)
// si ricorda in un piccolo database a parte, NON nei dati del diario: così non finisce mai nei backup.
// Dove il browser non offre la scelta, si ripiega sul download normale (vedi downloadJson in backup.js).
//
// Si ricordano due file separati, uno per il backup cifrato e uno per quello in chiaro: così un file
// con «-cifrato» nel nome non viene mai sostituito per sbaglio con un contenuto non cifrato (o il contrario).

const DB_NAME = 'diario_stoico_file';
const STORE = 'riferimenti';

export const KINDS = Object.freeze({ plain: 'semplice', encrypted: 'cifrato' });

/** Il browser può far scegliere dove salvare? */
export const fileChoiceAvailable = () => typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function operation(mode, action) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    const result = await new Promise((resolve, reject) => {
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await done;
    return result;
  } finally {
    db.close();
  }
}

/** Il file scelto l'ultima volta per quel tipo di backup, oppure null. */
export async function getRememberedFile(kind) {
  try {
    return (await operation('readonly', (s) => s.get(kind))) ?? null;
  } catch {
    return null;
  }
}

export async function rememberFile(kind, handle) {
  try {
    await operation('readwrite', (s) => s.put(handle, kind));
  } catch {
    /* non ricordarlo non è un errore: la prossima volta si sceglie di nuovo */
  }
}

export async function forgetFile(kind) {
  try {
    await operation('readwrite', (s) => s.delete(kind));
  } catch {
    /* idem */
  }
}

/** Apre la finestra di sistema «salva con nome». Lancia AbortError se si annulla. */
export function pickNewFile(suggestedName) {
  return window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'Backup di Diario Stoico', accept: { 'application/json': ['.json'] } }],
  });
}

/**
 * Si può scrivere sul file ricordato? Se serve chiede il permesso (va chiamata subito dopo un tocco).
 * Controlla anche che il file esista ancora (potrebbe essere stato spostato o cancellato).
 */
export async function canReuseFile(handle) {
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
    }
    await handle.getFile();
    return true;
  } catch {
    return false;
  }
}

/** Scrive il testo sul file. La sostituzione è atomica: o resta il vecchio contenuto, o c'è il nuovo intero. */
export async function writeToFile(handle, text) {
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
  } catch (err) {
    await writable.abort().catch(() => {});
    throw err;
  }
  await writable.close();
}
