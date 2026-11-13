// Il riquadro di un modulo nella pagina di un giorno: titolo, frase-guida, contenuto e «Nascondi per oggi».
// Dove si scrive, il riquadro si apre e si chiude toccando il titolo (vedi collapse.js); in lettura è sempre aperto.
// I dati si salvano da soli (stesso salvataggio automatico delle voci). Nascondere non cancella nulla.

import { createSaver } from '../autosave.js';
import { h } from '../dom.js';
import { dataSummary, saveInstance } from '../modules.js';
import { quoteForDate } from '../quotes.js';
import { toast } from '../ui.js';
import { collapsibleCard } from './collapse.js';
import { buildBody } from './modulebody.js';

/**
 * `def`: il modulo (già pronto o tuo); `instance`: i dati di quel giorno (o undefined).
 * `open` e `onToggle(aperto)`: se il riquadro parte aperto e che cosa fare quando lo si apre o chiude (ricordare la scelta).
 * Restituisce { element, saver } (saver è null dove non ci sono dati da salvare).
 */
export function moduleCard({ db, def, date, instance, readOnly = false, onHide, open = true, onToggle }) {
  const noData = def.type === 'quote';
  let latest = instance?.data ?? null;
  let flashTimer = null;
  const state = h('span', { class: 'save-state', role: 'status', 'aria-live': 'polite' });

  const saver =
    readOnly || noData
      ? null
      : createSaver(
          async () => {
            await saveInstance(db, date, def.id, def.type, latest);
          },
          {
            onState: (s, err) => {
              state.classList.toggle('is-error', s === 'errore');
              if (s === 'salvato' || s === 'errore') state.textContent = s === 'salvato' ? 'salvato' : 'non salvato';
              state.classList.toggle('is-flash', s === 'salvato');
              clearTimeout(flashTimer);
              if (s === 'salvato') flashTimer = setTimeout(() => state.classList.remove('is-flash'), 1400);
              if (s === 'errore') {
                console.error(err);
                toast('Non riesco a salvare l’ultima modifica. Riprovo appena possibile.');
              }
            },
          },
        );

  let body;
  let quoteText = '';
  if (def.type === 'quote') {
    const q = quoteForDate(date);
    quoteText = q.text;
    body = h(
      'blockquote',
      { class: 'mod-quote' },
      h('p', {}, q.text),
      h('cite', {}, h('strong', {}, q.author), h('span', {}, `${q.source} · trad. di ${q.translation}`)),
    );
  } else {
    body = buildBody({
      def,
      data: instance?.data,
      readOnly,
      onChange: (data) => {
        latest = data;
        saver?.schedule();
      },
    });
  }

  if (readOnly) {
    const element = h('section', { class: 'module is-read', 'data-module': def.id, 'aria-label': def.name }, h('header', { class: 'module-head' }, h('h2', {}, def.name)), body);
    return { element, saver };
  }

  const { element } = collapsibleCard({
    id: def.id,
    name: def.name,
    open,
    summarize: () => (noData ? quoteText : dataSummary(def.type, latest)),
    onToggle: (isOpen) => {
      if (!isOpen) saver?.flush(); // chiudendo, quello che si stava scrivendo si salva subito
      onToggle?.(isOpen);
    },
    content: [def.prompt ? h('p', { class: 'hint mod-prompt' }, def.prompt) : null, body],
    foot: [state, onHide ? h('button', { type: 'button', class: 'link-quiet module-hide', 'aria-label': `Nascondi «${def.name}» per questo giorno`, onclick: onHide }, 'Nascondi per oggi') : null],
  });
  // il salvataggio forzato in uscita passa dal saver: quando la scheda si chiude basta saver.close()
  return { element, saver };
}
