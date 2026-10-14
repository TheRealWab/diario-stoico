// Una riga di obiettivo: spunta + titolo (che apre il dettaglio). Usata nell'elenco, nel dettaglio e nella striscia di Oggi.

import { h } from '../dom.js';
import { STATUS_LABEL, toggleDone } from '../goals.js';
import { goalHash } from '../routes.js';
import { HORIZON_LABEL, periodLabel } from '../periods.js';
import { toast } from '../ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function checkIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
  svg.append(path);
  return svg;
}

/**
 * `extra`: testo sotto il titolo (es. il periodo, o quanti sotto-obiettivi ci sono).
 * `onChange(goal)` viene chiamata dopo ogni spunta.
 */
export function goalRow({ db, goal, extra = '', compact = false, onChange = () => {} }) {
  let current = goal;
  const tick = h('button', { type: 'button', class: 'tick', 'aria-pressed': String(goal.status === 'fatto'), onclick: toggle }, h('span', { class: 'tick-box' }, checkIcon()));
  const title = h('span', { class: 'goal-title' }, goal.title);
  const meta = h('span', { class: 'goal-meta' });
  const row = h(
    'li',
    { class: `goal-row${compact ? ' is-compact' : ''}` },
    tick,
    h('a', { class: 'goal-link', href: goalHash(goal.id) }, title, meta),
  );

  function paint() {
    const parts = [];
    if (extra) parts.push(extra);
    if (current.status === 'non_riuscito' || current.status === 'rimandato') parts.push(STATUS_LABEL[current.status]);
    meta.textContent = parts.join(' · ');
    meta.hidden = parts.length === 0;
    tick.setAttribute('aria-pressed', String(current.status === 'fatto'));
    tick.setAttribute('aria-label', `${current.status === 'fatto' ? 'Rimetti da fare' : 'Segna come fatto'}: ${current.title}`);
    row.dataset.status = current.status;
  }
  paint();

  async function toggle() {
    tick.disabled = true;
    try {
      current = await toggleDone(db, current.id);
      paint();
      onChange(current);
    } catch (err) {
      console.error(err);
      toast('Non riesco a salvare la spunta.');
    } finally {
      tick.disabled = false;
    }
  }
  return row;
}

/** Testo sotto il titolo per un obiettivo con sotto-obiettivi: «3 sotto-obiettivi». */
export const childrenText = (n) => (n === 0 ? '' : n === 1 ? '1 sotto-obiettivo' : `${n} sotto-obiettivi`);

export const periodText = (goal) => `${HORIZON_LABEL[goal.horizon]} · ${periodLabel(goal.horizon, goal.start)}`;
