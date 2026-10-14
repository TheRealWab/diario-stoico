// Piccole utilità senza dipendenze dal browser (usabili anche nei test).

export const APP_ID = 'diario-stoico';
// Versione mostrata in Impostazioni. Unica fonte: si cambia solo qui (e in package.json, lo controlla un test).
//   aggiornamento piccolo → 1.1, 1.2, 1.3 …      aggiornamento grande (nuova fase) → 2.0, 3.0 …
export const APP_VERSION = '3.1';

export const uuid = () => crypto.randomUUID();

// Istante preciso, solo per createdAt/updatedAt. Il "giorno" di una voce
// non si ricava mai da qui: vedi dates.js.
export const nowIso = (now = new Date()) => now.toISOString();
