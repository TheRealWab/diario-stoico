// Promemoria del backup: il diario vive solo su questo telefono, e un backup vecchio è l'unico vero rischio di perderlo.
// Qui ci sono le regole; il riquadro si disegna in views/today.js. Tono: un'informazione, non un rimprovero; si può rimandare o spegnere.

import { addDays, daysBetween } from './dates.js';

export const SNOOZE_DAYS = 3; // «Non ora»: per quanti giorni il promemoria tace

/**
 * C'è da ricordare il backup? Restituisce null (no) oppure { never, days }:
 *   never: non è mai stato fatto un backup
 *   days:  giorni passati dall'ultimo backup (oppure, se non c'è mai stato, dal primo giorno scritto)
 * `firstDate` è il giorno più lontano in cui c'è qualcosa di scritto (null = diario vuoto: niente da proteggere).
 */
export function backupReminder({ settings, today, firstDate }) {
  const every = settings.backupReminderDays;
  if (!every) return null; // spento
  if (settings.backupSnoozeUntil && today < settings.backupSnoozeUntil) return null; // rimandato
  const since = settings.lastBackupDate ?? firstDate;
  if (!since) return null;
  const days = daysBetween(since, today);
  if (days < every) return null;
  return { never: !settings.lastBackupDate, days };
}

/** Il giorno fino a cui tacere dopo «Non ora». */
export const snoozeUntil = (today) => addDays(today, SNOOZE_DAYS);

// «Fai il backup» porta alle Impostazioni, già sulla parte «Dati»: la richiesta resta qui finché quella pagina la legge.
let wantsDataSection = false;
export const askDataSection = () => {
  wantsDataSection = true;
};
export function takeDataSection() {
  const wanted = wantsDataSection;
  wantsDataSection = false;
  return wanted;
}

/** La frase del promemoria. */
export function reminderText({ never, days }) {
  if (never) return 'Non hai ancora fatto un backup. Il diario vive solo su questo telefono.';
  return `L’ultimo backup è di ${days} giorni fa. Il diario vive solo su questo telefono.`;
}
