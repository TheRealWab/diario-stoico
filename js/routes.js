// Indirizzi interni dell'app (nella parte dopo il «#», così funzionano su GitHub Pages senza server).
//   #/oggi                  pagina di oggi
//   #/giorno/AAAA-MM-GG     un altro giorno
//   #/impostazioni

import { isValidDateStr } from './dates.js';

export function parseRoute(hash) {
  const h = hash || '#/oggi';
  if (h === '#/impostazioni') return { name: 'settings' };
  const m = /^#\/giorno\/(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (m && isValidDateStr(m[1])) return { name: 'day', date: m[1] };
  return { name: 'today' };
}

export function dayHash(date, today) {
  return date === today ? '#/oggi' : `#/giorno/${date}`;
}
