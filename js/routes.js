// Indirizzi interni dell'app (nella parte dopo il «#», così funzionano su GitHub Pages senza server).
//   #/oggi                           oggi (si scrive)
//   #/giorno/AAAA-MM-GG              un altro giorno: i giorni passati si aprono in lettura, quelli futuri in modifica
//   #/giorno/AAAA-MM-GG/modifica     un giorno passato, in modifica
//   #/archivio                       calendario (mese corrente)
//   #/archivio/mese/AAAA-MM          calendario di un mese
//   #/archivio/cronologia            elenco dei giorni
//   #/archivio/cerca                 ricerca
//   #/impostazioni

import { isValidDateStr, isValidMonthStr } from './dates.js';

/** `today` è la data di oggi ("AAAA-MM-GG"): serve a decidere se un giorno è passato. */
export function parseRoute(hash, today) {
  const h = hash || '#/oggi';
  if (h === '#/impostazioni') return { name: 'settings' };
  if (h === '#/archivio') return { name: 'archive', section: 'calendar', month: null };
  if (h === '#/archivio/cronologia') return { name: 'archive', section: 'history' };
  if (h === '#/archivio/cerca') return { name: 'archive', section: 'search' };

  let m = /^#\/archivio\/mese\/(\d{4}-\d{2})$/.exec(h);
  if (m && isValidMonthStr(m[1])) return { name: 'archive', section: 'calendar', month: m[1] };

  m = /^#\/giorno\/(\d{4}-\d{2}-\d{2})(\/modifica)?$/.exec(h);
  if (m && isValidDateStr(m[1])) {
    const date = m[1];
    if (date === today) return { name: 'today', date, mode: 'edit' };
    return { name: 'day', date, mode: m[2] || date > today ? 'edit' : 'read' };
  }
  return { name: 'today', date: today, mode: 'edit' };
}

/** Indirizzo di un giorno: oggi → #/oggi; passato → lettura (o modifica se richiesto). */
export function dayHash(date, today, { edit = false } = {}) {
  if (date === today) return '#/oggi';
  return edit && date < today ? `#/giorno/${date}/modifica` : `#/giorno/${date}`;
}

/** Le schermate sono di due tipi: «home» (Oggi e i giorni) e «tab» (Archivio, Impostazioni). */
export const isTabRoute = (route) => route.name === 'archive' || route.name === 'settings';

/** Quale voce della barra in basso è attiva. */
export function tabHashOf(route) {
  if (route.name === 'archive') return '#/archivio';
  if (route.name === 'settings') return '#/impostazioni';
  return '#/oggi';
}

export const familyOf = (route) => (route.name === 'archive' ? 'archive' : route.name === 'settings' ? 'settings' : 'home');
