// Indirizzi interni dell'app (nella parte dopo il «#», così funzionano su GitHub Pages senza server).
//   #/oggi                           oggi (si scrive)
//   #/giorno/AAAA-MM-GG              un altro giorno: i giorni passati si aprono in lettura, quelli futuri in modifica
//   #/giorno/AAAA-MM-GG/modifica     un giorno passato, in modifica
//   #/archivio                       calendario (mese corrente)
//   #/archivio/mese/AAAA-MM          calendario di un mese
//   #/archivio/cronologia            elenco dei giorni
//   #/archivio/cerca                 ricerca
//   #/obiettivi                      obiettivi (l'ultimo orizzonte usato, periodo corrente)
//   #/obiettivi/settimana            obiettivi di un orizzonte (giorno | settimana | mese | anno), periodo corrente
//   #/obiettivi/mese/AAAA-MM-GG      …del periodo che contiene quella data
//   #/obiettivo/<id>                 un obiettivo, con i suoi sotto-obiettivi
//   #/impostazioni

import { isValidDateStr, isValidMonthStr } from './dates.js';
import { isHorizon } from './periods.js';

/** `today` è la data di oggi ("AAAA-MM-GG"): serve a decidere se un giorno è passato. */
export function parseRoute(hash, today) {
  const h = hash || '#/oggi';
  if (h === '#/impostazioni') return { name: 'settings' };
  if (h === '#/archivio') return { name: 'archive', section: 'calendar', month: null };
  if (h === '#/archivio/cronologia') return { name: 'archive', section: 'history' };
  if (h === '#/archivio/cerca') return { name: 'archive', section: 'search' };

  let m = /^#\/archivio\/mese\/(\d{4}-\d{2})$/.exec(h);
  if (m && isValidMonthStr(m[1])) return { name: 'archive', section: 'calendar', month: m[1] };

  if (h === '#/obiettivi') return { name: 'goals', horizon: null, date: null };
  m = /^#\/obiettivi\/([a-z]+)(?:\/(\d{4}-\d{2}-\d{2}))?$/.exec(h);
  if (m && isHorizon(m[1]) && (m[2] === undefined || isValidDateStr(m[2]))) return { name: 'goals', horizon: m[1], date: m[2] ?? null };

  m = /^#\/obiettivo\/([\w-]{1,64})$/.exec(h);
  if (m) return { name: 'goal', id: m[1] };

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

export const goalsHash = (horizon, date = null) => (date ? `#/obiettivi/${horizon}/${date}` : `#/obiettivi/${horizon}`);
export const goalHash = (id) => `#/obiettivo/${id}`;

/** Le schermate sono di due tipi: «home» (Oggi e i giorni) e «tab» (Archivio, Obiettivi, Impostazioni). */
export const isTabRoute = (route) => route.name === 'archive' || route.name === 'settings' || route.name === 'goals';

/** Voce della barra in basso a cui appartiene una schermata. */
export function tabHashOf(route) {
  if (route.name === 'archive') return '#/archivio';
  if (route.name === 'settings') return '#/impostazioni';
  if (route.name === 'goals' || route.name === 'goal') return '#/obiettivi';
  return '#/oggi';
}

export const familyOf = (route) => {
  if (route.name === 'archive') return 'archive';
  if (route.name === 'settings') return 'settings';
  if (route.name === 'goals' || route.name === 'goal') return 'goals';
  return 'home';
};

const TAB_OF_FAMILY = { home: '#/oggi', archive: '#/archivio', goals: '#/obiettivi', settings: '#/impostazioni' };

/**
 * Quale voce della barra tenere accesa. Una schermata di dettaglio (un giorno, un obiettivo) lascia accesa
 * la voce da cui è stata aperta: un giorno aperto dall'archivio → «Archivio»; un obiettivo aperto da Oggi → «Oggi».
 */
export function activeTab(route, historyState) {
  if (!isTabRoute(route) && historyState?.depth >= 2 && TAB_OF_FAMILY[historyState.parent]) return TAB_OF_FAMILY[historyState.parent];
  return tabHashOf(route);
}
