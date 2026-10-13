// Salvataggio automatico con attesa (debounce) e salvataggio forzato in uscita.

const pending = new Set();

/**
 * Crea un "salvatore": `schedule()` ad ogni modifica, `flush()` per salvare subito.
 * `save` viene chiamata al momento del salvataggio, così legge sempre il testo più recente.
 */
export function createSaver(save, { delay = 700, onState = () => {} } = {}) {
  let timer = null;
  let dirty = false;

  const saver = {
    schedule() {
      dirty = true;
      pending.add(saver);
      clearTimeout(timer);
      timer = setTimeout(() => saver.flush(), delay);
      onState('modificato');
    },
    async flush() {
      clearTimeout(timer);
      timer = null;
      if (!dirty) return;
      dirty = false;
      try {
        await save();
        if (!dirty) pending.delete(saver);
        onState('salvato');
      } catch (err) {
        dirty = true; // resta da salvare: ci riproviamo alla prossima occasione
        onState('errore', err);
      }
    },
    /** Salva quel che manca e smette di essere osservato. */
    async close() {
      await saver.flush();
      pending.delete(saver);
    },
  };
  return saver;
}

/** Salva tutto ciò che è in attesa. Da chiamare prima di cambiare schermata o chiudere. */
export function flushAll() {
  return Promise.allSettled([...pending].map((s) => s.flush()));
}

export function pendingCount() {
  return pending.size;
}
