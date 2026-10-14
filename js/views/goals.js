// Pagina «Obiettivi»: un orizzonte alla volta (giorno, settimana, mese, anno), un periodo alla volta.

import { formatLong, todayStr } from '../dates.js';
import { h, icon } from '../dom.js';
import { closureDialog, goalFormDialog } from '../goaldialogs.js';
import { closeGoal, createGoal, listChildren, listDayGoalsBetween, listGoalsForPeriod, listParentCandidates, listPendingClosure } from '../goals.js';
import { goalsHash } from '../routes.js';
import { HORIZONS, HORIZON_LABEL, containsDate, periodFor, periodLabel, shiftPeriod } from '../periods.js';
import { toast } from '../ui.js';
import { childrenText, goalRow } from './goalrow.js';

// ricordato finché l'app è aperta: tornando sulla pagina si ritrova l'ultimo orizzonte usato
const memory = { horizon: 'settimana' };

const CURRENT_TEXT = { giorno: 'Oggi', settimana: 'Questa settimana', mese: 'Questo mese', anno: 'Quest’anno' };
const EMPTY_TEXT = {
  giorno: 'Nessun obiettivo per questo giorno.',
  settimana: 'Nessun obiettivo per questa settimana.',
  mese: 'Nessun obiettivo per questo mese.',
  anno: 'Nessun obiettivo per quest’anno.',
};

export async function mountGoals({ db, container, route }) {
  const today = todayStr();
  const horizon = route.horizon ?? memory.horizon;
  memory.horizon = horizon;
  const period = periodFor(horizon, route.date ?? today);
  const isCurrent = containsDate(period, today);

  const [goals, pending, dayGoals] = await Promise.all([
    listGoalsForPeriod(db, horizon, period.start),
    listPendingClosure(db, today),
    horizon === 'settimana' ? listDayGoalsBetween(db, period.start, period.end) : [], // anche quelli dei singoli giorni
  ]);
  const childCounts = new Map(await Promise.all(goals.map(async (g) => [g.id, (await listChildren(db, g.id)).length])));

  const hrefFor = (start) => goalsHash(horizon, start);
  const rerender = () => mountGoals({ db, container, route });

  const nav = h(
    'nav',
    { class: 'segmented seg-links four', 'aria-label': 'Orizzonte' },
    HORIZONS.map((hz) => h('a', { href: goalsHash(hz), 'data-nav': 'replace', 'aria-current': hz === horizon ? 'page' : null }, h('span', {}, HORIZON_LABEL[hz]))),
  );

  const head = h(
    'div',
    { class: 'cal-head' },
    h('a', { class: 'icon-btn', href: hrefFor(shiftPeriod(horizon, period.start, -1).start), 'data-nav': 'replace', 'aria-label': 'Periodo precedente' }, icon('chevron-left')),
    h('h2', { class: 'cal-title period-title' }, periodLabel(horizon, period.start)),
    h('a', { class: 'icon-btn', href: hrefFor(shiftPeriod(horizon, period.start, 1).start), 'data-nav': 'replace', 'aria-label': 'Periodo successivo' }, icon('chevron-right')),
  );

  const list = h(
    'ul',
    { class: 'goal-list' },
    goals.map((g) => goalRow({ db, goal: g, extra: childrenText(childCounts.get(g.id) ?? 0) })),
  );

  // gli obiettivi dei singoli giorni della settimana, raggruppati per giorno
  const dayDates = [...new Set(dayGoals.map((g) => g.start))];
  const daysBlock = dayDates.length
    ? h(
        'div',
        { class: 'goals-days' },
        h('h3', { class: 'goals-sub' }, 'Nei singoli giorni'),
        dayDates.map((date) =>
          h(
            'div',
            { class: 'strip-group' },
            h('p', { class: 'strip-label' }, formatLong(date).replace(/ \d{4}$/, '')),
            h('ul', { class: 'goal-list' }, dayGoals.filter((g) => g.start === date).map((g) => goalRow({ db, goal: g, compact: true }))),
          ),
        ),
      )
    : null;

  const closureCard = pending.length
    ? h(
        'div',
        { class: 'notice' },
        h('p', {}, pending.length === 1 ? 'Un obiettivo di un periodo concluso aspetta di sapere com’è andata.' : `${pending.length} obiettivi di periodi conclusi aspettano di sapere com’è andata.`),
        h('p', { class: 'hint' }, 'Quando vuoi, in un minuto. Non c’è fretta.'),
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => runClosureFlow(db, pending, rerender) }, 'Rivedi'),
      )
    : null;

  container.replaceChildren(
    h(
      'section',
      { class: 'page goals' },
      h('h1', { class: 'page-title' }, 'Obiettivi'),
      nav,
      h('div', { class: 'archive-body' }, head, isCurrent ? null : h('a', { class: 'link-quiet center', href: goalsHash(horizon), 'data-nav': 'replace' }, CURRENT_TEXT[horizon]), closureCard, goals.length ? list : daysBlock ? null : h('p', { class: 'empty' }, EMPTY_TEXT[horizon]), daysBlock, h('button', { type: 'button', class: 'btn btn-add', onclick: addGoal }, icon('plus'), 'Nuovo obiettivo')),
    ),
  );

  async function addGoal() {
    const candidates = await listParentCandidates(db, horizon, period.start);
    const result = await goalFormDialog({ heading: 'Nuovo obiettivo', context: `${HORIZON_LABEL[horizon]} · ${periodLabel(horizon, period.start)}`, submitLabel: 'Aggiungi', candidates });
    if (!result) return;
    try {
      await createGoal(db, { title: result.title, note: result.note, parentId: result.parentId, horizon, date: period.start });
      await rerender();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Non riesco a creare l’obiettivo.');
    }
  }

  return { destroy() {} };
}

/** Chiusura guidata, un obiettivo alla volta. Si può saltare o fermarsi quando si vuole. */
export async function runClosureFlow(db, pending, onDone) {
  let closed = 0;
  for (let index = 0; index < pending.length; index++) {
    const answer = await closureDialog({ goal: pending[index], flow: { index, total: pending.length } });
    if (answer.action === 'stop') break;
    if (answer.action === 'skip') continue;
    try {
      await closeGoal(db, pending[index].id, answer);
      closed++;
    } catch (err) {
      console.error(err);
      toast('Non riesco a salvare questa chiusura.');
      break;
    }
  }
  if (closed) toast(closed === 1 ? 'Chiusura salvata.' : `${closed} chiusure salvate.`);
  await onDone();
}
