// Finestre per gli obiettivi: nuovo/modifica, sotto-obiettivo, chiusura guidata.

import { todayStr } from './dates.js';
import { h } from './dom.js';
import { NOTE_MAX, OUTCOMES, REFLECTION_MAX, STATUS_LABEL, TITLE_MAX } from './goals.js';
import { HORIZON_LABEL, NEXT_PERIOD_TEXT, containsDate, periodLabel, periodsWithin, shorterHorizons } from './periods.js';

let counter = 0;
const uid = () => `gd-${++counter}`;

// quando compare la tastiera il campo scelto viene portato nella parte visibile della finestra
const scrollOnFocus = (el) => el.addEventListener('focus', () => setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));

function textField(label, props) {
  const id = uid();
  const input = h('input', { id, type: 'text', class: 'text-input', autocomplete: 'off', ...props });
  scrollOnFocus(input);
  return { input, element: h('div', { class: 'field-row' }, h('label', { for: id }, label), input) };
}

function textArea(label, props, value = '') {
  const id = uid();
  const input = h('textarea', { id, class: 'text-input text-area', rows: '3', ...props }, value);
  scrollOnFocus(input);
  return { input, element: h('div', { class: 'field-row' }, h('label', { for: id }, label), input) };
}

function selectField(label, options, value) {
  const id = uid();
  const select = h('select', { id, class: 'text-input' }, options.map(([val, text]) => h('option', { value: val }, text)));
  select.value = value;
  return { select, element: h('div', { class: 'field-row' }, h('label', { for: id }, label), select) };
}

function present(dlg, result) {
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'ok' ? result() : null);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// `getDlg` è una funzione perché la finestra non esiste ancora quando si costruiscono i suoi pulsanti
const closeBtn = (getDlg, text) => h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => getDlg().close('') }, text);

/** Titolo, nota e (facoltativo) genitore. Restituisce { title, note, parentId } oppure null. */
export function goalFormDialog({ heading, context = '', submitLabel = 'Salva', title = '', note = '', parentId = null, candidates = [] }) {
  const titleField = textField('Titolo', { maxlength: TITLE_MAX, value: title, enterkeyhint: 'done', placeholder: 'Che cosa vuoi fare?' });
  const noteField = textArea('Nota (facoltativa)', { maxlength: NOTE_MAX }, note);
  const parentField = candidates.length
    ? selectField('Fa parte di (facoltativo)', [['', 'Nessun obiettivo più grande'], ...candidates.map((g) => [g.id, `${HORIZON_LABEL[g.horizon]} · ${periodLabel(g.horizon, g.start)} — ${g.title}`])], parentId ?? '')
    : null;
  const error = h('p', { class: 'form-error', role: 'alert' });
  const dlg = h(
    'dialog',
    { class: 'dialog', 'aria-label': heading },
    h('h2', { class: 'dialog-title' }, heading),
    context ? h('p', { class: 'dialog-text' }, context) : null,
    titleField.element,
    noteField.element,
    parentField?.element,
    error,
    h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, submitLabel), closeBtn(() => dlg, 'Annulla')),
  );
  function submit() {
    if (!titleField.input.value.trim()) {
      error.textContent = 'Scrivi un titolo.';
      return titleField.input.focus();
    }
    dlg.close('ok');
  }
  titleField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  return present(dlg, () => ({ title: titleField.input.value, note: noteField.input.value, parentId: parentField ? parentField.select.value || null : parentId }));
}

/** Nuovo sotto-obiettivo di `parent`: orizzonte e periodo da scegliere tra quelli contenuti. Restituisce { title, note, horizon, date } o null. */
export function subGoalDialog(parent) {
  const horizons = shorterHorizons(parent.horizon);
  const horizonField = selectField('Orizzonte', horizons.map((hz) => [hz, HORIZON_LABEL[hz]]), horizons[0]);
  const periodField = selectField('Periodo', [['', '']], '');
  const titleField = textField('Titolo', { maxlength: TITLE_MAX, enterkeyhint: 'done', placeholder: 'Che cosa vuoi fare?' });
  const noteField = textArea('Nota (facoltativa)', { maxlength: NOTE_MAX });
  const error = h('p', { class: 'form-error', role: 'alert' });
  if (horizons.length === 1) horizonField.select.disabled = true;

  const today = todayStr();
  function fillPeriods() {
    const periods = periodsWithin(parent, horizonField.select.value);
    periodField.select.replaceChildren(...periods.map((p) => h('option', { value: p.start }, periodLabel(horizonField.select.value, p.start))));
    const current = periods.find((p) => containsDate(p, today)) ?? periods[0];
    if (current) periodField.select.value = current.start;
  }
  horizonField.select.addEventListener('change', fillPeriods);
  fillPeriods();

  const dlg = h(
    'dialog',
    { class: 'dialog', 'aria-label': 'Nuovo sotto-obiettivo' },
    h('h2', { class: 'dialog-title' }, 'Nuovo sotto-obiettivo'),
    h('p', { class: 'dialog-text' }, `Dentro: ${parent.title}`),
    horizonField.element,
    periodField.element,
    titleField.element,
    noteField.element,
    error,
    h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, 'Aggiungi'), closeBtn(() => dlg, 'Annulla')),
  );
  function submit() {
    if (!titleField.input.value.trim()) {
      error.textContent = 'Scrivi un titolo.';
      return titleField.input.focus();
    }
    dlg.close('ok');
  }
  return present(dlg, () => ({ title: titleField.input.value, note: noteField.input.value, horizon: horizonField.select.value, date: periodField.select.value }));
}

/**
 * Chiusura guidata di un obiettivo: com'è andata + una riga facoltativa. Nessun punteggio.
 * `flow` ({ index, total }) la trasforma in un passo di una sequenza (con «Salta» e «Basta per ora»).
 * Restituisce { action: 'save', outcome, reflection } | { action: 'skip' } | { action: 'stop' }.
 * (Annullare una chiusura singola equivale a «stop».)
 */
export function closureDialog({ goal, flow = null }) {
  let outcome = goal.closure?.outcome ?? null;
  let action = 'stop';
  const name = `outcome-${uid()}`;
  const carryRow = h('p', { class: 'hint', hidden: true }, `Scegliendo «Rimandato» l’obiettivo si sposta ${NEXT_PERIOD_TEXT[goal.horizon]}.`);
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: outcome === null, onclick: () => ((action = 'save'), dlg.close('ok')) }, flow && flow.index < flow.total - 1 ? 'Salva e continua' : 'Salva');
  const reflection = textArea('Una riga su com’è andata (facoltativa)', { maxlength: REFLECTION_MAX, placeholder: 'Che cosa ti porti via da questo periodo?' }, goal.closure?.reflection ?? '');

  const options = h(
    'div',
    { class: 'segmented outcomes' },
    OUTCOMES.map((value) => {
      const input = h('input', {
        type: 'radio',
        name,
        value,
        onchange: () => {
          outcome = value;
          saveBtn.disabled = false;
          carryRow.hidden = value !== 'rimandato';
        },
      });
      input.checked = value === outcome;
      return h('label', {}, input, h('span', {}, STATUS_LABEL[value]));
    }),
  );
  carryRow.hidden = outcome !== 'rimandato';

  const actions = [saveBtn];
  if (flow) {
    actions.push(h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => ((action = 'skip'), dlg.close('ok')) }, 'Salta questo'));
    actions.push(h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Basta per ora'));
  } else {
    actions.push(closeBtn(() => dlg, 'Annulla'));
  }

  const dlg = h(
    'dialog',
    { class: 'dialog', 'aria-label': 'Com’è andata?' },
    flow ? h('p', { class: 'dialog-step' }, `${flow.index + 1} di ${flow.total}`) : null,
    h('h2', { class: 'dialog-title' }, 'Com’è andata?'),
    h('p', { class: 'dialog-goal' }, goal.title),
    h('p', { class: 'dialog-text' }, `${HORIZON_LABEL[goal.horizon]} · ${periodLabel(goal.horizon, goal.start)}`),
    options,
    carryRow,
    reflection.element,
    h('div', { class: 'dialog-actions' }, actions),
  );
  return present(dlg, () =>
    action === 'save'
      ? { action: 'save', outcome, reflection: reflection.input.value }
      : { action },
  ).then((result) => result ?? { action: 'stop' });
}
