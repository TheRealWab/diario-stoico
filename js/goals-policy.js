// Quando l'app propone di «chiudere» un obiettivo (dire com'è andata).
//
// Scelta di tono concordata: niente promemoria per i singoli giorni (nessun senso di colpa ogni sera),
// e niente arretrato infinito. Si cambia modificando questi due valori.

import { daysBetween } from './dates.js';

export const CLOSURE_POLICY = Object.freeze({
  horizons: ['settimana', 'mese', 'anno'], // orizzonti per cui si propone la chiusura
  windowDays: 60, // solo i periodi finiti da non più di questi giorni
});

/** Va proposta la chiusura di questo obiettivo? Solo se il periodo è finito e non è stato né spuntato né deciso. */
export function needsClosure(goal, today, policy = CLOSURE_POLICY) {
  return (
    goal.status === 'da_fare' &&
    goal.end < today &&
    policy.horizons.includes(goal.horizon) &&
    daysBetween(goal.end, today) <= policy.windowDays
  );
}
