// Un obiettivo: stato, nota, chiusura, genitore e sotto-obiettivi.

import { formatLong } from '../dates.js';
import { h, icon } from '../dom.js';
import { closureDialog, goalFormDialog, subGoalDialog } from '../goaldialogs.js';
import { STATUSES, STATUS_LABEL, closeGoal, countByStatus, createGoal, deleteGoal, getGoal, listChildren, listParentCandidates, postponeGoal, updateGoal } from '../goals.js';
import { goBackOr } from '../navigation.js';
import { goalHash, goalsHash } from '../routes.js';
import { HORIZON_LABEL, NEXT_PERIOD_TEXT, periodLabel } from '../periods.js';
import { confirmDialog, toast } from '../ui.js';
import { childrenText, goalRow, periodText } from './goalrow.js';

let radioCounter = 0;

export async function mountGoal({ db, container, id }) {
  const goal = await getGoal(db, id);
  if (!goal) {
    container.replaceChildren(
      h('section', { class: 'page goals' }, h('h1', { class: 'page-title' }, 'Obiettivo non trovato'), h('p', { class: 'hint' }, 'Forse è stato eliminato.'), h('a', { class: 'btn btn-secondary', href: goalsHash('settimana'), 'data-nav': 'replace' }, 'Vai agli obiettivi')),
    );
    return { destroy() {} };
  }
  const rerender = () => mountGoal({ db, container, id });
  const parent = goal.parentId ? await getGoal(db, goal.parentId) : null;
  const children = await listChildren(db, goal.id);
  const counts = countByStatus(children);

  const radioName = `status-${++radioCounter}`;
  const statusControl = h(
    'fieldset',
    { class: 'field' },
    h('legend', {}, 'Stato'),
    h(
      'div',
      { class: 'segmented status-choice' },
      // «Rimandato» non è più uno stato da scegliere (sposta l'obiettivo, vedi il pulsante «Rimanda»); si mostra solo se c'è già
      STATUSES.filter((s) => s !== 'rimandato' || goal.status === 'rimandato').map((s) => {
        const input = h('input', { type: 'radio', name: radioName, value: s, onchange: () => saveStatus(s) });
        input.checked = s === goal.status;
        return h('label', {}, input, h('span', {}, STATUS_LABEL[s]));
      }),
    ),
  );

  const closureBox = goal.closure
    ? h(
        'section',
        { class: 'closure-box' },
        h('p', { class: 'closure-head' }, `Chiusura · ${formatLong(goal.closure.date)}`),
        h('p', { class: 'closure-outcome' }, STATUS_LABEL[goal.closure.outcome]),
        goal.closure.reflection ? h('p', { class: 'closure-reflection' }, goal.closure.reflection) : null,
      )
    : null;

  const childrenSection =
    goal.horizon === 'giorno'
      ? null
      : h(
          'section',
          { class: 'group' },
          h('h2', {}, 'Sotto-obiettivi'),
          children.length ? h('p', { class: 'hint' }, summaryText(counts)) : h('p', { class: 'hint' }, 'Nessuno. Puoi scomporre questo obiettivo in parti più piccole, se ti aiuta.'),
          children.length ? h('ul', { class: 'goal-list' }, children.map((c) => goalRow({ db, goal: c, extra: periodText(c), onChange: rerenderSummary }))) : null,
          h('button', { type: 'button', class: 'btn btn-add', onclick: addChild }, icon('plus'), 'Sotto-obiettivo'),
        );

  container.replaceChildren(
    h(
      'section',
      { class: 'page goal' },
      parent ? h('a', { class: 'goal-parent', href: goalHash(parent.id) }, h('span', {}, 'Fa parte di'), h('strong', {}, `${HORIZON_LABEL[parent.horizon]} · ${periodLabel(parent.horizon, parent.start)} — ${parent.title}`)) : null,
      h('p', { class: 'goal-period' }, periodText(goal)),
      h('h1', { class: 'goal-heading' }, goal.title),
      statusControl,
      goal.note ? h('p', { class: 'goal-note' }, goal.note) : null,
      closureBox,
      h(
        'div',
        { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeIt }, goal.closure ? 'Rivedi la chiusura' : 'Com’è andata?'),
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: postpone }, `Rimanda ${NEXT_PERIOD_TEXT[goal.horizon]}`),
      ),
      childrenSection,
      h('div', { class: 'row goal-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: edit }, 'Modifica'), h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', onclick: remove }, 'Elimina')),
    ),
  );

  function summaryText(c) {
    const parts = [];
    if (c.fatto) parts.push(`${c.fatto} ${c.fatto === 1 ? 'fatto' : 'fatti'}`);
    if (c.da_fare) parts.push(`${c.da_fare} da fare`);
    if (c.rimandato) parts.push(`${c.rimandato} ${c.rimandato === 1 ? 'rimandato' : 'rimandati'}`);
    if (c.non_riuscito) parts.push(`${c.non_riuscito} non ${c.non_riuscito === 1 ? 'riuscito' : 'riusciti'}`);
    return `${childrenText(children.length)}: ${parts.join(' · ')}`;
  }
  // la spunta di un sotto-obiettivo aggiorna il riepilogo senza ridisegnare la pagina
  async function rerenderSummary() {
    const fresh = await listChildren(db, goal.id);
    const text = container.querySelector('.group .hint');
    if (text) text.textContent = summaryText(countByStatus(fresh));
  }

  async function saveStatus(status) {
    try {
      await updateGoal(db, goal.id, { status });
    } catch (err) {
      console.error(err);
      toast('Non riesco a salvare lo stato.');
    }
    await rerender();
  }

  async function closeIt() {
    const answer = await closureDialog({ goal });
    if (answer.action !== 'save') return;
    try {
      const { moved, detached } = await closeGoal(db, goal.id, answer);
      if (moved) toast(movedText(detached));
    } catch (err) {
      console.error(err);
      toast('Non riesco a salvare la chiusura.');
    }
    await rerender();
  }

  const movedText = (detached) => `Spostato ${NEXT_PERIOD_TEXT[goal.horizon]}.${detached ? ` ${detached === 1 ? 'Un sotto-obiettivo è rimasto' : `${detached} sotto-obiettivi sono rimasti`} nel periodo di prima, senza genitore.` : ''}`;

  // «Rimanda»: l'obiettivo si sposta al periodo successivo e sparisce da quello di prima
  async function postpone() {
    try {
      const { detached } = await postponeGoal(db, goal.id);
      toast(movedText(detached));
    } catch (err) {
      console.error(err);
      toast('Non riesco a rimandare l’obiettivo.');
    }
    await rerender();
  }

  async function addChild() {
    const result = await subGoalDialog(goal);
    if (!result) return;
    try {
      await createGoal(db, { title: result.title, note: result.note, horizon: result.horizon, date: result.date, parentId: goal.id });
    } catch (err) {
      console.error(err);
      toast(err.message || 'Non riesco a creare il sotto-obiettivo.');
    }
    await rerender();
  }

  async function edit() {
    const candidates = await listParentCandidates(db, goal.horizon, goal.start);
    const result = await goalFormDialog({ heading: 'Modifica obiettivo', context: periodText(goal), title: goal.title, note: goal.note, parentId: goal.parentId, candidates });
    if (!result) return;
    try {
      await updateGoal(db, goal.id, { title: result.title, note: result.note, parentId: result.parentId });
    } catch (err) {
      console.error(err);
      toast(err.message || 'Non riesco a salvare le modifiche.');
    }
    await rerender();
  }

  async function remove() {
    const n = children.length;
    const ok = await confirmDialog({
      title: 'Eliminare questo obiettivo?',
      text: n
        ? `«${goal.title}» verrà cancellato per sempre. ${n === 1 ? 'Il suo sotto-obiettivo resta' : `I suoi ${n} sotto-obiettivi restano`}, senza genitore.`
        : `«${goal.title}» verrà cancellato per sempre. Non si può annullare.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGoal(db, goal.id);
      toast('Obiettivo eliminato.');
      goBackOr(goalsHash(goal.horizon, goal.start));
    } catch (err) {
      console.error(err);
      toast('Non riesco a eliminare l’obiettivo.');
    }
  }

  return { destroy() {} };
}
