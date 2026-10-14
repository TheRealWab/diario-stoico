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
  // Anche negli altri campi di testo (aggiunta veloce di un obiettivo, ricerca…) la barra di navigazione
  // si toglie: con la tastiera aperta finirebbe sopra il campo, coprendolo.
  const isTextField = (node) => node instanceof HTMLElement && node.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select');
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) document.body.classList.add('typing');
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!isTextField(document.activeElement)) document.body.classList.remove('typing');
    }, 0);
  });
  document.addEventListener('selectionchange', () => {
    if (document.body.classList.contains('writing')) {
      refreshState();
      followCaret();
    }
  });
  document.addEventListener('input', (e) => {
    if (inEditor(e.target)) followCaret();
  });
  // quando la tastiera compare o scompare lo spazio visibile cambia
  window.visualViewport?.addEventListener('resize', followCaret);
  document.addEventListener('focusin', (e) => {
    if (inEditor(e.target)) setTimeout(followCaret, 350);
  });
}

// Mantiene il cursore visibile: sopra la barra degli strumenti (e quindi sopra la tastiera),
// e non troppo in alto. Il telefono da solo non conosce l'altezza della nostra barra.
let followQueued = false;
function followCaret() {
  if (followQueued) return;
  followQueued = true;
  requestAnimationFrame(() => {
    followQueued = false;
    const bar = document.querySelector('.toolbar');
    const sel = getSelection();
    if (!bar || !document.body.classList.contains('writing') || !sel?.rangeCount || !inEditor(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    let rect = range.getClientRects()[0];
    if (!rect || rect.height === 0) {
      // riga vuota: il cursore non ha un rettangolo suo, si usa quello del paragrafo
      const node = sel.anchorNode;
      rect = (node.nodeType === 1 ? node : node.parentElement).getBoundingClientRect();
    }
    const margin = 28;
    const bottomLimit = bar.getBoundingClientRect().top - margin;
    const topLimit = margin;
    if (rect.bottom > bottomLimit) window.scrollBy(0, rect.bottom - bottomLimit);
    else if (rect.top < topLimit) window.scrollBy(0, rect.top - topLimit);
  });
}
