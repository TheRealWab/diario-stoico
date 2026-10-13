// Date del diario: stringhe locali "AAAA-MM-GG" nel fuso Europe/Rome.
// Mai timestamp UTC per identificare "il giorno".

export const TIME_ZONE = 'Europe/Rome';

const romeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function romeParts(now) {
  const parts = {};
  for (const p of romeFormat.formatToParts(now)) parts[p.type] = p.value;
  return parts;
}

/** Data di oggi a Roma, es. "2026-10-13". */
export function todayStr(now = new Date()) {
  const p = romeParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Ora attuale a Roma, es. "09:41". */
export function timeStr(now = new Date()) {
  const p = romeParts(now);
  return `${p.hour}:${p.minute}`;
}

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

// Aritmetica di calendario: si usa UTC solo come "calcolatrice" di giorni,
// così l'ora legale non può spostare il risultato.
function toUtc(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt) {
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(s, n) {
  const dt = toUtc(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** Giorni da `a` a `b` (positivo se b è dopo a). */
export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

const weekdayFormat = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long' });
const restFormat = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** { weekday: "martedì", rest: "13 ottobre 2026" } */
export function formatLongParts(s) {
  const dt = toUtc(s);
  return { weekday: weekdayFormat.format(dt), rest: restFormat.format(dt) };
}

/** "martedì 13 ottobre 2026" */
export function formatLong(s) {
  const { weekday, rest } = formatLongParts(s);
  return `${weekday} ${rest}`;
}

/** "13 ottobre 2026" */
export function formatDayMonthYear(s) {
  return restFormat.format(toUtc(s));
}

/** Testo per l'indicatore del backup: "mai", "oggi", "1 giorno fa", "5 giorni fa". */
export function daysAgoLabel(lastDate, today) {
  if (!lastDate) return 'mai';
  const n = daysBetween(lastDate, today);
  if (n <= 0) return 'oggi';
  return n === 1 ? '1 giorno fa' : `${n} giorni fa`;
}
