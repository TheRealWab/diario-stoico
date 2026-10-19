// Modalità lettura: un giorno passato, pulito e a tutta pagina. Un tocco per passare alla modifica.

import { h } from '../dom.js';
import { listEntriesForDay } from '../entries.js';
import { parse, toDom } from '../markdown.js';
import { loadDayModules, readableModules } from './daymodules.js';
import { dayHead, dayLinks } from './dayhead.js';
import { moduleCard } from './modulecard.js';
import { buildStrip } from './strip.js';

const LABEL_TEXT = { mattina: 'Mattina', giorno: 'Giorno', sera: 'Sera' };

export async function mountRead({ db, container, date }) {
  const entries = (await listEntriesForDay(db, date)).filter((e) => parse(e.content).length > 0);
  const editHash = `#/giorno/${date}/modifica`;

  // i moduli: la citazione e gli obiettivi se c'erano, gli altri solo se hai scritto qualcosa (anche se poi archiviati)
  const ctx = await loadDayModules(db, date, { includeArchived: true });
  const shown = readableModules(ctx);
  const build = async (def) => (def.type === 'goals' ? buildStrip({ db, date }) : moduleCard({ db, def, date, instance: ctx.instances.get(def.id), readOnly: true }).element);
  const [top, bottom] = await Promise.all(['top', 'bottom'].map((slot) => Promise.all(shown.filter((d) => d.slot === slot).map(build))));

  const body = entries.length
    ? h(
        'div',
        { class: 'entries' },
        entries.map((e) =>
          h(
            'article',
            { class: 'entry entry-read' },
            e.label ? h('header', { class: 'entry-head' }, h('span', { class: 'entry-label' }, LABEL_TEXT[e.label])) : null,
            h('div', { class: 'read-body prose' }, toDom(parse(e.content), document)),
          ),
        ),
      )
    : h('p', { class: 'empty' }, 'Nessuna voce in questo giorno.');

  container.replaceChildren(
    h(
      'section',
      { class: 'page day read' },
      dayHead(date),
      dayLinks(date, { reading: true }),
      top.length ? h('div', { class: 'modules' }, top) : null,
      h('div', { class: 'read-actions' }, h('a', { class: 'btn btn-secondary', href: editHash, 'data-nav': 'replace' }, entries.length ? 'Modifica' : 'Scrivi')),
      body,
      bottom.length ? h('div', { class: 'modules' }, bottom) : null,
    ),
  );
  return { destroy() {} };
}
