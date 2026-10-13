// Griglia del calendario mensile (settimana da lunedì). Solo calcoli: il disegno è in views/archive.js.

import { addDays, daysInMonth, weekdayIndex } from './dates.js';

export const WEEKDAYS_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/**
 * Settimane del mese `ym` ("AAAA-MM"): ogni cella è { date, inMonth }.
 * Le righe sono quelle necessarie (4-6); i giorni dei mesi vicini servono a riempire le righe.
 */
export function monthGrid(ym) {
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  let cursor = addDays(first, -weekdayIndex(first));
  const weeks = [];
  while (cursor <= last) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor.startsWith(ym) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
