// Periodi degli obiettivi: giorno, settimana (da lunedì), mese, anno.
// Solo calcoli di calendario: niente database, niente pagina.
//
// Un periodo si descrive con { start, end } (date "AAAA-MM-GG", estremi compresi).
// Regola della cascata: un obiettivo può avere come genitore un obiettivo di orizzonte PIÙ LUNGO
// il cui periodo contiene la DATA DI INIZIO del suo periodo. Una settimana appartiene quindi al mese
// in cui comincia (il lunedì); si può anche saltare un livello (un giorno sotto un mese).

import { addDays, addMonths, daysInMonth, formatDayMonthShort, formatLong, monthLabel, weekdayIndex } from './dates.js';

export const HORIZONS = ['giorno', 'settimana', 'mese', 'anno']; // dal più corto al più lungo
export const HORIZON_LABEL = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese', anno: 'Anno' };

export const rank = (horizon) => HORIZONS.indexOf(horizon);
export const isHorizon = (value) => HORIZONS.includes(value);

const pad = (n, size = 2) => String(n).padStart(size, '0');

/** Il periodo di `horizon` che contiene `date`. */
export function periodFor(horizon, date) {
  switch (horizon) {
    case 'giorno':
      return { start: date, end: date };
    case 'settimana': {
      const start = addDays(date, -weekdayIndex(date));
      return { start, end: addDays(start, 6) };
    }
    case 'mese': {
      const ym = date.slice(0, 7);
      return { start: `${ym}-01`, end: `${ym}-${pad(daysInMonth(ym))}` };
    }
    case 'anno': {
      const y = date.slice(0, 4);
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    default:
      throw new Error(`Orizzonte non valido: ${horizon}`);
  }
}

/** Il periodo `n` posti dopo (o prima, se n < 0) quello che comincia in `start`. */
export function shiftPeriod(horizon, start, n) {
  switch (horizon) {
    case 'giorno':
      return periodFor(horizon, addDays(start, n));
    case 'settimana':
      return periodFor(horizon, addDays(start, 7 * n));
    case 'mese':
      return periodFor(horizon, `${addMonths(start.slice(0, 7), n)}-01`);
    case 'anno':
      return periodFor(horizon, `${pad(Number(start.slice(0, 4)) + n, 4)}-01-01`);
    default:
      throw new Error(`Orizzonte non valido: ${horizon}`);
  }
}

export const containsDate = (period, date) => period.start <= date && date <= period.end;

/** Gli orizzonti più corti di `horizon`, dal più vicino: mese → [settimana, giorno]. */
export const shorterHorizons = (horizon) => HORIZONS.slice(0, rank(horizon)).reverse();

/** Può `parent` essere il genitore di un obiettivo che comincia in `child.start`? */
export function canBeParent(child, parent) {
  return rank(parent.horizon) > rank(child.horizon) && child.start >= parent.start && child.start <= parent.end;
}

/** Tutti i periodi di `horizon` che cominciano dentro `parent` (per scegliere dove mettere un sotto-obiettivo). */
export function periodsWithin(parent, horizon) {
  if (rank(horizon) >= rank(parent.horizon)) return [];
  const result = [];
  let cursor = periodFor(horizon, parent.start);
  if (cursor.start < parent.start) cursor = shiftPeriod(horizon, cursor.start, 1); // il primo periodo comincia prima: appartiene a quello prima
  while (cursor.start <= parent.end) {
    result.push(cursor);
    cursor = shiftPeriod(horizon, cursor.start, 1);
  }
  return result;
}

/** Testo del periodo: "martedì 13 ottobre 2026", "28 set – 4 ott 2026", "ottobre 2026", "2026". */
export function periodLabel(horizon, start) {
  const { end } = periodFor(horizon, start);
  switch (horizon) {
    case 'giorno':
      return formatLong(start);
    case 'settimana': {
      const sameYear = start.slice(0, 4) === end.slice(0, 4);
      return `${formatDayMonthShort(start)}${sameYear ? '' : ` ${start.slice(0, 4)}`} – ${formatDayMonthShort(end)} ${end.slice(0, 4)}`;
    }
    case 'mese':
      return monthLabel(start.slice(0, 7));
    case 'anno':
      return start.slice(0, 4);
    default:
      return start;
  }
}

/** Il nome del periodo successivo, per «Riporta a…»: "alla prossima settimana". */
export const NEXT_PERIOD_TEXT = { giorno: 'a domani', settimana: 'alla prossima settimana', mese: 'al prossimo mese', anno: 'al prossimo anno' };
