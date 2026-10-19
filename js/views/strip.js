// La striscia degli obiettivi nella pagina di un giorno: quelli del giorno e quelli della sua settimana,
// spuntabili con un tocco, senza uscire dal diario. Un campo veloce per aggiungere un obiettivo del giorno.

import { todayStr } from '../dates.js';
import { h, setChildren } from '../dom.js';
import { TITLE_MAX, createGoal, listForDayStrip } from '../goals.js';
import { containsDate, periodFor } from '../periods.js';
import { goalsHash } from '../routes.js';
import { toast } from '../ui.js';
import { goalRow } from './goalrow.js';

export async function buildStrip({ db, date, onHide = null }) {
  const today = todayStr();
  const { day, week } = await listForDayStrip(db, date);
  const isToday = date === today;
  const dayLabel = isToday ? 'Oggi' : 'Questo giorno';
  const weekLabel = containsDate(periodFor('settimana', date), today) ? 'Questa settimana' : 'Settimana';

  const root = h('section', { class: 'strip', 'aria-label': 'Obiettivi' });
  const adder = h('div', { class: 'strip-adder' });

  function group(label, goals) {
    if (!goals.length) return null;
    return h('div', { class: 'strip-group' }, h('p', { class: 'strip-label' }, label), h('ul', { class: 'goal-list' }, goals.map((g) => goalRow({ db, goal: g, compact: true }))));
  }

  function paint() {
    setChildren(
      root,
      h(
        'div',
        { class: 'strip-head' },
        h('h2', {}, 'Obiettivi'),
        h(
          'div',
          { class: 'strip-links' },
          h('a', { class: 'link-quiet', href: goalsHash('settimana') }, 'Tutti'),
          onHide ? h('button', { type: 'button', class: 'link-quiet module-hide', 'aria-label': 'Nascondi gli obiettivi per questo giorno', onclick: onHide }, 'Nascondi') : null,
        ),
      ),
      group(dayLabel, day),
      group(weekLabel, week),
      day.length || week.length ? null : h('p', { class: 'hint' }, isToday ? 'Nessun obiettivo per oggi.' : 'Nessun obiettivo per questo giorno.'),
      adder,
    );
    showAddButton();
  }

  function showAddButton() {
    adder.replaceChildren(h('button', { type: 'button', class: 'link-button strip-add', onclick: openAdder }, isToday ? '+ Aggiungi un obiettivo per oggi' : '+ Aggiungi un obiettivo per questo giorno'));
  }

  function openAdder() {
    const input = h('input', { type: 'text', class: 'text-input', maxlength: TITLE_MAX, placeholder: 'Che cosa vuoi fare?', 'aria-label': 'Nuovo obiettivo', enterkeyhint: 'done', autocomplete: 'off' });
    const ok = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Aggiungi');
    // un vero modulo: il tasto «Fatto» della tastiera del telefono lo invia anche quando non manda un «Invio» riconoscibile
    const form = h('form', { class: 'strip-form' }, input, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      add();
    });
    adder.replaceChildren(form);
    input.focus();
    setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); // dopo che la tastiera è comparsa
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') showAddButton();
    });
    input.addEventListener('blur', () => {
      // si chiude da solo se si esce dal campo senza scrivere nulla (non quando si preme «Aggiungi»)
      setTimeout(() => {
        if (adder.contains(input) && !input.value.trim() && document.activeElement !== ok) showAddButton();
      }, 150);
    });

    async function add() {
      const title = input.value.trim();
      if (!title) return input.focus();
      ok.disabled = true;
      try {
        day.push(await createGoal(db, { title, horizon: 'giorno', date }));
        paint();
        openAdder(); // pronto per un altro
      } catch (err) {
        console.error(err);
        toast(err.message || 'Non riesco a creare l’obiettivo.');
        ok.disabled = false;
      }
    }
  }

  paint();
  return root;
}
