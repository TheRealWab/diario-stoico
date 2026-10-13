// Finestre di dialogo e avvisi.

import { h } from './dom.js';

let dialogCounter = 0;

/**
 * Mostra una finestra modale. `actions`: [{ label, value, kind: 'primary' | 'danger' | 'ghost' }].
 * Si risolve con il `value` del pulsante premuto, oppure null se si chiude (Esc, indietro).
 */
export function showDialog({ title, body = [], actions }) {
  return new Promise((resolve) => {
    const titleId = `dialog-title-${++dialogCounter}`;
    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId },
      h('h2', { class: 'dialog-title', id: titleId }, title),
      h('div', { class: 'dialog-body' }, body),
      h(
        'div',
        { class: 'dialog-actions' },
        actions.map((a) =>
          h('button', { type: 'button', class: `btn btn-${a.kind ?? 'ghost'}`, onclick: () => dlg.close(a.value) }, a.label),
        ),
      ),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue || null);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Chiede conferma. Si risolve con true/false. */
export async function confirmDialog({ title, text, confirmLabel, danger = false, cancelLabel = 'Annulla' }) {
  const answer = await showDialog({
    title,
    body: [h('p', {}, text)],
    actions: [
      { label: confirmLabel, value: 'yes', kind: danger ? 'danger' : 'primary' },
      { label: cancelLabel, value: 'no', kind: 'ghost' },
    ],
  });
  return answer === 'yes';
}

export function messageDialog({ title, text, items = [] }) {
  return showDialog({
    title,
    body: [h('p', {}, text), items.length ? h('ul', { class: 'dialog-list' }, items.map((i) => h('li', {}, i))) : null],
    actions: [{ label: 'Ok', value: 'ok', kind: 'primary' }],
  });
}

let toastEl = null;
let toastTimer = null;

/** Avviso discreto in basso. Con `action` resta finché non lo si usa o lo si chiude. */
export function toast(message, { actionLabel, onAction, sticky = false } = {}) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  clearTimeout(toastTimer);
  // (replaceChildren scriverebbe «null» come testo: i nodi vuoti si tolgono prima)
  toastEl.replaceChildren(
    ...[
      h('span', { class: 'toast-text' }, message),
      actionLabel
        ? h('button', { type: 'button', class: 'toast-action', onclick: () => { hide(); onAction?.(); } }, actionLabel)
        : null,
    ].filter(Boolean),
  );
  toastEl.classList.add('is-visible');
  if (!sticky && !actionLabel) toastTimer = setTimeout(hide, 4000);

  function hide() {
    toastEl.classList.remove('is-visible');
  }
}
