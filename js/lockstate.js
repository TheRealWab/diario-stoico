// Il blocco è attivo? Lo leggono app.js (per bloccare quando si lascia l'app) e le impostazioni (quando lo si cambia).
// Il blocco conta come attivo solo se esiste un PIN valido: senza, nessuno potrebbe più sbloccare.

import { isPinRecord } from './pin.js';

export const lockState = { active: false };

export const isLockActive = (settings) => !!settings.lockEnabled && isPinRecord(settings.pinHash);

export function refreshLockState(settings) {
  lockState.active = isLockActive(settings);
  try {
    // promemoria per boot.js: all'apertura nasconde subito la pagina, prima ancora che il database sia pronto
    if (lockState.active) localStorage.setItem('ds-lock-hint', '1');
    else localStorage.removeItem('ds-lock-hint');
  } catch {
    /* solo una comodità */
  }
  if (!lockState.active) document.documentElement.classList.remove('boot-lock');
}
