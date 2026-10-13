// Controllo del PIN con attesa dopo troppi errori (lo usano la schermata di blocco e le impostazioni).

import { EMPTY_LOCKOUT, loadLockout, recordFailure, remainingMs, saveLockout } from './lockout.js';
import { verifyPin } from './pin.js';

/** Restituisce { ok, waitMs }: waitMs > 0 = bisogna aspettare prima di riprovare. */
export async function tryPin(pin, record, now = Date.now()) {
  const state = loadLockout();
  const waiting = remainingMs(state, now);
  if (waiting > 0) return { ok: false, waitMs: waiting };
  if (await verifyPin(pin, record)) {
    saveLockout({ ...EMPTY_LOCKOUT });
    return { ok: true, waitMs: 0 };
  }
  const next = recordFailure(state, now);
  saveLockout(next);
  return { ok: false, waitMs: remainingMs(next, now) };
}

export const currentWaitMs = (now = Date.now()) => remainingMs(loadLockout(), now);

export function waitMessage(ms) {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `Troppi tentativi. Riprova tra ${Math.ceil(s / 60)} min.` : `Troppi tentativi. Riprova tra ${s} secondi.`;
}
