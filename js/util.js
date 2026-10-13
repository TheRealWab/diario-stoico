// Piccole utilità senza dipendenze dal browser (usabili anche nei test).

export const APP_ID = 'diario-stoico';
export const APP_VERSION = '1.0.0';

export const uuid = () => crypto.randomUUID();

// Istante preciso, solo per createdAt/updatedAt. Il "giorno" di una voce
// non si ricava mai da qui: vedi dates.js.
export const nowIso = (now = new Date()) => now.toISOString();
