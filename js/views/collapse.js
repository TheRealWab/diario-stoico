// Un riquadro della pagina del giorno che si apre e si chiude toccando il titolo.
// Chiuso mostra solo il titolo e, sotto, una riga con quello che c'è dentro. Lo usano i moduli e la striscia degli obiettivi.

import { h, icon } from '../dom.js';

let counter = 0;

/**
 * `summarize()`: la riga da mostrare da chiuso (stringa, anche vuota), calcolata ogni volta che si chiude.
 * `onToggle(aperto)`: chiamata dopo ogni tocco sul titolo (per ricordare la scelta, per salvare prima di chiudere…).
 * `content`: i nodi del corpo. `foot`: ciò che sta in fondo al riquadro aperto (comandi come «Nascondi per oggi», lo stato «salvato»).
 * Restituisce { element, isOpen, refreshSummary }.
 */
export function collapsibleCard({ className = 'module', id = null, name, open, summarize, onToggle, content = [], foot = [] }) {
  const bodyId = `module-body-${++counter}`;
  const footNodes = foot.filter(Boolean);
  const body = h('div', { class: 'module-body', id: bodyId }, content, footNodes.length ? h('div', { class: 'module-foot' }, footNodes) : null);
  const summary = h('p', { class: 'module-summary' });
  const toggle = h('button', { type: 'button', class: 'module-toggle', 'aria-controls': bodyId }, h('span', {}, name), icon('chevron-down'));
  const element = h('section', { class: className, 'data-module': id, 'aria-label': name }, h('header', { class: 'module-head' }, h('h2', {}, toggle)), summary, body);

  let isOpen = false;
  const refreshSummary = () => {
    const text = isOpen ? '' : summarize();
    summary.textContent = text;
    summary.hidden = !text;
  };
  function set(next) {
    isOpen = next;
    toggle.setAttribute('aria-expanded', String(next));
    body.hidden = !next;
    element.classList.toggle('is-open', next);
    element.classList.toggle('is-closed', !next);
    refreshSummary();
  }
  toggle.addEventListener('click', () => {
    set(!isOpen);
    onToggle?.(isOpen);
  });
  set(open);
  return { element, isOpen: () => isOpen, refreshSummary };
}
