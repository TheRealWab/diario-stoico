// Editor di testo: un contenteditable semplice. Quello che si salva non è l'HTML
// dell'editor ma il Markdown ricavato da esso (vedi markdown.js).

import { fromDom, parse, serialize, toDom } from './markdown.js';

let initialized = false;

function initOnce() {
  if (initialized) return;
  initialized = true;
  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch {
    /* non supportato: fromDom gestisce comunque div e br */
  }
}

export function createEditor({ markdown = '', label, onInput }) {
  initOnce();
  const el = document.createElement('div');
  el.className = 'editor';
  el.contentEditable = 'true';
  el.setAttribute('role', 'textbox');
  el.setAttribute('aria-multiline', 'true');
  el.setAttribute('aria-label', label);
  el.setAttribute('data-placeholder', 'Scrivi…');
  el.setAttribute('lang', 'it');
  el.spellcheck = true;
  el.setAttribute('autocapitalize', 'sentences');

  const refreshEmpty = () => el.classList.toggle('is-empty', el.textContent.trim() === '' && !el.querySelector('li'));

  el.replaceChildren(toDom(parse(markdown), document));
  refreshEmpty();

  el.addEventListener('input', () => {
    refreshEmpty();
    onInput?.();
  });

  // Si incolla solo testo semplice: niente HTML dall'esterno.
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((line, i) => {
      if (i > 0) document.execCommand('insertParagraph');
      if (line) document.execCommand('insertText', false, line);
    });
  });
  el.addEventListener('drop', (e) => e.preventDefault());

  return {
    element: el,
    getMarkdown: () => serialize(fromDom(el)),
    focus() {
      el.focus();
      // cursore alla fine del testo
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    },
  };
}
