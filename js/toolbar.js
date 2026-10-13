// Barra degli strumenti compatta: compare al posto della barra di navigazione
// solo mentre si scrive in un editor.

import { h } from './dom.js';

const BUTTONS = [
  { cmd: 'bold', label: 'Grassetto', text: 'B', cls: 'tb-bold' },
  { cmd: 'italic', label: 'Corsivo', text: 'I', cls: 'tb-italic' },
  { cmd: 'heading', label: 'Titoletto', text: 'Tt', cls: 'tb-heading' },
  { cmd: 'insertUnorderedList', label: 'Elenco puntato', text: '•', cls: 'tb-ul' },
  { cmd: 'insertOrderedList', label: 'Elenco numerato', text: '1.', cls: 'tb-ol' },
];

const inEditor = (node) => !!node && !!(node.nodeType === 1 ? node : node.parentElement)?.closest('.editor');

function selectionBlock() {
  const sel = getSelection();
  let node = sel?.anchorNode ?? null;
  if (node && node.nodeType === 3) node = node.parentElement;
  return node?.closest?.('h2') ?? null;
}

export function initToolbar() {
  const buttons = new Map();
  const bar = h(
    'div',
    { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formattazione del testo' },
    BUTTONS.map((b) => {
      const btn = h('button', { type: 'button', class: `tb-btn ${b.cls}`, 'aria-label': b.label, 'aria-pressed': 'false', 'data-cmd': b.cmd }, b.text);
      buttons.set(b.cmd, btn);
      return btn;
    }),
    h('button', { type: 'button', class: 'tb-btn tb-done', 'data-cmd': 'done' }, 'Fatto'),
  );
  document.body.append(bar);

  // Premere un pulsante non deve togliere il cursore dal testo (e la tastiera dallo schermo).
  const keepFocus = (e) => e.preventDefault();
  bar.addEventListener('pointerdown', keepFocus);
  bar.addEventListener('mousedown', keepFocus);

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd === 'done') {
      document.activeElement?.blur();
    } else if (cmd === 'heading') {
      document.execCommand('formatBlock', false, selectionBlock() ? 'p' : 'h2');
    } else {
      document.execCommand(cmd);
    }
    refreshState();
  });

  function refreshState() {
    for (const cmd of ['bold', 'italic', 'insertUnorderedList', 'insertOrderedList']) {
      let on = false;
      try {
        on = document.queryCommandState(cmd);
      } catch {
        /* ignora */
      }
      buttons.get(cmd).setAttribute('aria-pressed', String(on));
    }
    buttons.get('heading').setAttribute('aria-pressed', String(!!selectionBlock()));
  }

  function setWriting(on) {
    document.body.classList.toggle('writing', on);
    if (on) refreshState();
  }

  document.addEventListener('focusin', (e) => {
    if (inEditor(e.target)) setWriting(true);
  });
  document.addEventListener('focusout', () => {
    // il focus passa per un attimo da nessuna parte quando si cambia editor
    setTimeout(() => {
      if (!inEditor(document.activeElement)) setWriting(false);
    }, 0);
  });
  document.addEventListener('selectionchange', () => {
    if (document.body.classList.contains('writing')) refreshState();
  });
}
