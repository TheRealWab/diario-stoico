// Quali moduli ci sono in un giorno e quali mostrare: serve sia alla pagina di modifica sia alla lettura.

import { arrangeForDay, enabledIds, getDay, listAllDefs, listInstancesForDay, orderDefs } from '../modules.js';
import { getSettings } from '../settings.js';

/**
 * Legge tutto ciò che serve per disegnare i moduli di un giorno.
 * Restituisce { defs, enabled, day, instances, visible, available, withData }.
 * `includeArchived`: anche i moduli archiviati (in lettura i giorni passati mostrano ciò che hai scritto allora).
 */
export async function loadDayModules(db, date, { includeArchived = false } = {}) {
  const [all, settings, day, instances] = await Promise.all([listAllDefs(db, { includeArchived }), getSettings(db), getDay(db, date), listInstancesForDay(db, date)]);
  const defs = orderDefs(all, settings.moduleOrder); // nell'ordine scelto, con «sopra/sotto le voci» ricavato da lì
  const enabled = enabledIds(settings);
  return { defs, enabled, day, instances, ...arrangeForDay(defs, enabled, day, instances) };
}

const NO_FIELDS = ['quote', 'goals'];

/**
 * In lettura: la citazione e gli obiettivi se sono visibili quel giorno; gli altri moduli solo se c'è qualcosa di scritto
 * (e non sono stati nascosti in quel giorno).
 */
export const readableModules = (ctx) => ctx.defs.filter((d) => (NO_FIELDS.includes(d.type) ? ctx.visible.includes(d) : ctx.withData.has(d.id) && !ctx.day.hidden.includes(d.id)));
