// Intestazione di un giorno (data grande + frecce), comune a lettura e modifica.

import { addDays, formatLongParts, todayStr } from '../dates.js';
import { h, icon } from '../dom.js';
import { go } from '../navigation.js';
import { dayHash } from '../routes.js';

export function dayHead(date) {
  const parts = formatLongParts(date);
  const to = (d) => go(dayHash(d, todayStr()), 'replace'); // un giorno passato si apre in lettura
  return h(
    'header',
    { class: 'day-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Giorno precedente', onclick: () => to(addDays(date, -1)) }, icon('chevron-left')),
    h('h1', { class: 'day-title' }, h('span', { class: 'weekday' }, parts.weekday), ' ', h('span', { class: 'daydate' }, parts.rest)),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Giorno successivo', onclick: () => to(addDays(date, 1)) }, icon('chevron-right')),
  );
}

/** Piccoli collegamenti sotto la data: «Vista lettura» (giorni passati in modifica) e «Torna a oggi». */
export function dayLinks(date, { reading = false } = {}) {
  const today = todayStr();
  const links = [];
  if (date < today && !reading) links.push(h('a', { class: 'link-quiet', href: dayHash(date, today), 'data-nav': 'replace' }, 'Vista lettura'));
  if (date !== today) links.push(h('a', { class: 'link-quiet', href: '#/oggi', 'data-nav': 'replace' }, 'Torna a oggi'));
  return links.length ? h('nav', { class: 'day-links', 'aria-label': 'Collegamenti' }, links) : null;
}
