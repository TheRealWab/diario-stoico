// Archivio: calendario, cronologia e ricerca.

import { dayPreview, listDays, monthDays } from '../archive.js';
import { WEEKDAYS_SHORT, monthGrid } from '../calendar.js';
import { addMonths, formatLong, isValidDateStr, monthLabel, monthOf, todayStr } from '../dates.js';
import { getAll } from '../db.js';
import { h, icon } from '../dom.js';
import { go, isBackNavigation } from '../navigation.js';
import { dayHash } from '../routes.js';
import { MIN_QUERY_LENGTH, searchEntries } from '../search.js';

const LABEL_TEXT = { mattina: 'Mattina', giorno: 'Giorno', sera: 'Sera' };
const PAGE = 30;

// Ricordato finché l'app è aperta: tornando da un giorno, ritrovi la ricerca e l'elenco com'erano.
const memory = { query: '', historyLoaded: 0 };

const SECTIONS = [
  ['calendar', 'Calendario', '#/archivio'],
  ['history', 'Cronologia', '#/archivio/cronologia'],
  ['search', 'Cerca', '#/archivio/cerca'],
];

export async function mountArchive({ db, container, route }) {
  const today = todayStr();
  const body = h('div', { class: 'archive-body' });
  const nav = h(
    'nav',
    { class: 'segmented seg-links', 'aria-label': 'Sezioni dell’archivio' },
    SECTIONS.map(([id, label, href]) =>
      h('a', { href, 'data-nav': 'replace', 'aria-current': route.section === id ? 'page' : null }, h('span', {}, label)),
    ),
  );
  container.replaceChildren(h('section', { class: 'page archive' }, h('h1', { class: 'page-title' }, 'Archivio'), nav, body));

  if (route.section === 'history') await mountHistory(db, body, today);
  else if (route.section === 'search') await mountSearch(db, body, today);
  else await mountCalendar(db, body, today, route.month ?? monthOf(today));
  return { destroy() {} };
}

// ---------- calendario ----------

async function mountCalendar(db, body, today, ym) {
  const counts = await monthDays(db, ym);
  const monthHref = (m) => `#/archivio/mese/${m}`;

  const picker = h('input', {
    type: 'date',
    class: 'visually-hidden',
    'aria-label': 'Scegli una data',
    tabindex: '-1',
    onchange: () => {
      if (isValidDateStr(picker.value)) go(dayHash(picker.value, todayStr()));
    },
  });
  const openPicker = () => {
    try {
      picker.showPicker();
    } catch {
      picker.click();
    }
  };

  const weeks = monthGrid(ym);
  const grid = h(
    'div',
    { class: 'cal', role: 'grid', 'aria-label': monthLabel(ym) },
    h('div', { class: 'cal-row cal-weekdays', role: 'row' }, WEEKDAYS_SHORT.map((d) => h('span', { role: 'columnheader' }, d))),
    weeks.map((week) =>
      h(
        'div',
        { class: 'cal-row', role: 'row' },
        week.map((cell) => {
          if (!cell.inMonth) return h('span', { class: 'cal-day is-blank', role: 'gridcell', 'aria-hidden': 'true' });
          const n = counts.get(cell.date) ?? 0;
          return h(
            'a',
            {
              class: `cal-day${cell.date === today ? ' is-today' : ''}${n ? ' has-entries' : ''}`,
              role: 'gridcell',
              href: dayHash(cell.date, today),
              'aria-label': `${formatLong(cell.date)}${n ? `, ${n} ${n === 1 ? 'voce' : 'voci'}` : ''}`,
            },
            h('span', { class: 'cal-num' }, String(Number(cell.date.slice(8)))),
            h('span', { class: 'cal-dot' }),
          );
        }),
      ),
    ),
  );

  body.replaceChildren(
    h(
      'div',
      { class: 'cal-head' },
      h('a', { class: 'icon-btn', href: monthHref(addMonths(ym, -1)), 'data-nav': 'replace', 'aria-label': 'Mese precedente' }, icon('chevron-left')),
      h('h2', { class: 'cal-title' }, monthLabel(ym)),
      h('a', { class: 'icon-btn', href: monthHref(addMonths(ym, 1)), 'data-nav': 'replace', 'aria-label': 'Mese successivo' }, icon('chevron-right')),
    ),
    grid,
    h(
      'div',
      { class: 'cal-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: openPicker }, 'Vai a data…'),
      ym === monthOf(today) ? null : h('a', { class: 'btn btn-ghost', href: '#/archivio', 'data-nav': 'replace' }, 'Questo mese'),
      picker,
    ),
    h('p', { class: 'hint cal-hint' }, 'Il puntino segna i giorni in cui hai scritto.'),
  );
}

// ---------- cronologia ----------

async function mountHistory(db, body, today) {
  const list = h('div', { class: 'history' });
  const empty = h('p', { class: 'empty' }, 'Ancora nessuna voce. Quando scrivi, i giorni compaiono qui.');
  const more = h('button', { type: 'button', class: 'btn btn-secondary btn-more', hidden: true, onclick: () => load(PAGE) }, 'Mostra giorni precedenti');
  body.replaceChildren(list, empty, more);
  empty.hidden = true;

  let before = null;
  async function load(limit) {
    const { days, hasMore } = await listDays(db, { before, limit });
    for (const d of days) {
      const n = d.entries.length;
      list.append(
        h(
          'a',
          { class: 'day-card', href: dayHash(d.date, today) },
          h('span', { class: 'day-card-date' }, formatLong(d.date)),
          h('span', { class: 'day-card-meta' }, `${n} ${n === 1 ? 'voce' : 'voci'}`),
          h('span', { class: 'day-card-preview' }, dayPreview(d.entries)),
        ),
      );
    }
    if (days.length) before = days[days.length - 1].date;
    memory.historyLoaded += days.length;
    more.hidden = !hasMore;
    empty.hidden = list.childElementCount > 0;
  }
  // tornando indietro da un giorno si ricarica lo stesso numero di giorni, così lo scorrimento torna al suo posto
  const initial = isBackNavigation() ? Math.max(PAGE, memory.historyLoaded) : PAGE;
  memory.historyLoaded = 0;
  await load(initial);
}

// ---------- ricerca ----------

async function mountSearch(db, body, today) {
  const entries = await getAll(db, 'entries');
  const status = h('p', { class: 'hint search-status', role: 'status', 'aria-live': 'polite' });
  const results = h('div', { class: 'results' });
  const input = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Cerca nelle tue voci',
    'aria-label': 'Cerca nelle tue voci',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    value: memory.query,
  });
  body.replaceChildren(input, status, results);

  const run = () => {
    memory.query = input.value;
    const query = input.value.trim();
    results.replaceChildren();
    if (query.length < MIN_QUERY_LENGTH) {
      status.textContent = entries.length ? 'Scrivi almeno due lettere. Accenti e maiuscole non contano.' : 'Non c’è ancora nulla da cercare.';
      return;
    }
    const { results: found, total } = searchEntries(entries, query);
    if (!total) {
      status.textContent = `Nessun risultato per «${query}».`;
      return;
    }
    status.textContent = total === 1 ? '1 risultato' : total > found.length ? `${total} risultati (mostrati i primi ${found.length})` : `${total} risultati`;
    for (const { entry, parts } of found) {
      results.append(
        h(
          'a',
          { class: 'result', href: dayHash(entry.date, today) },
          h('span', { class: 'day-card-date' }, formatLong(entry.date)),
          entry.label ? h('span', { class: 'day-card-meta' }, LABEL_TEXT[entry.label]) : null,
          h('span', { class: 'day-card-preview' }, parts.map((p) => (p.match ? h('mark', {}, p.text) : p.text))),
        ),
      );
    }
  };

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 200);
  });
  run();
  if (!isBackNavigation() && !memory.query) input.focus();
}
