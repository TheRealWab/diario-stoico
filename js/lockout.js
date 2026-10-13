// Tentativi sbagliati di PIN: dopo cinque errori si deve aspettare, e l'attesa cresce.
// Non è un blocco «a prova di tutto» (il blocco è un cancello, non una cifratura) ma scoraggia
// chi prova i PIN a caso con il telefono in mano.

export const FREE_ATTEMPTS = 5;
const WAIT_STEPS_S = [30, 60, 120, 300, 600, 900];
export const EMPTY_LOCKOUT = Object.freeze({ failures: 0, until: 0 });
const STORAGE_KEY = 'ds-lockout';

/** Attesa (in millisecondi) dopo `failures` errori consecutivi. */
export function delayAfter(failures) {
  if (failures < FREE_ATTEMPTS) return 0;
  return WAIT_STEPS_S[Math.min(failures - FREE_ATTEMPTS, WAIT_STEPS_S.length - 1)] * 1000;
}

export function recordFailure(state, now) {
  const failures = (state?.failures ?? 0) + 1;
  return { failures, until: now + delayAfter(failures) };
}

export function remainingMs(state, now) {
  return Math.max(0, (state?.until ?? 0) - now);
}

export function loadLockout(storage = globalThis.localStorage) {
  try {
    const s = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (s && Number.isInteger(s.failures) && Number.isFinite(s.until)) return s;
  } catch {
    /* nessun dato salvato */
  }
  return { ...EMPTY_LOCKOUT };
}

export function saveLockout(state, storage = globalThis.localStorage) {
  try {
    if (state.failures === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* la comodità di ricordare i tentativi non è essenziale */
  }
}
