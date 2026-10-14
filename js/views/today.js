// Pagina "Oggi" (e, con le frecce, qualsiasi altro giorno).

import { createSaver } from '../autosave.js';
import { timeStr } from '../dates.js';
import { h, icon } from '../dom.js';
import { createEditor } from '../editor.js';
import { LABELS, compareEntries, createEntry, deleteEntry, listEntriesForDay, updateEntry } from '../entries.js';
import { confirmDialog, toast } from '../ui.js';
import { dayHead, dayLinks } from './dayhead.js';
import { buildStrip } from './strip.js';

const LABEL_TEXT = { mattina: 'Mattina', giorno: 'Giorno', sera: 'Sera' };

export async function mountToday({ db, container, date }) {
  const entries = await listEntriesForDay(db, date);
  const strip = await buildStrip({ db, date });
  const views = new Map(); // id -> { entry, root, saver, editor }

  const list = h('div', { class: 'entries' });
  const empty = h('p', { class: 'empty' }, 'Una pagina bianca. Scrivi quando vuoi, anche una sola riga.');
  const addBtn = h('button', { type: 'button', class: 'btn btn-add', onclick: addEntry }, icon('plus'), 'Nuova voce');

  const page = h(
    'section',
    { class: 'page day' },
    dayHead(date),
    dayLinks(date),
    strip,
    list,
    empty,
    addBtn,
  );
  container.replaceChildren(page);

  entries.forEach(insertEntry);
  refreshEmpty();

  function refreshEmpty() {
    empty.hidden = views.size > 0;
  }

  function insertEntry(entry) {
    const view = buildEntry(entry);
    views.set(entry.id, view);
    // posizione in ordine di ora (come quando si riapre il giorno)
    const after = [...views.values()].filter((v) => v !== view).sort((a, b) => compareEntries(a.entry, b.entry)).find((v) => compareEntries(v.entry, entry) > 0);
    list.insertBefore(view.root, after ? after.root : null);
    return view;
  }

  function buildEntry(entry) {
    const state = h('span', { class: 'save-state', role: 'status', 'aria-live': 'polite' });
    const editor = createEditor({
      markdown: entry.content,
      label: `Voce delle ${entry.time}`,
      onInput: () => saver.schedule(),
    });
    let flashTimer = null;
    const saver = createSaver(
      async () => {
        await updateEntry(db, entry.id, { content: editor.getMarkdown() });
      },
      {
        onState: (s, err) => {
          state.classList.toggle('is-error', s === 'errore');
          if (s === 'salvato' || s === 'errore') state.textContent = s === 'salvato' ? 'salvato' : 'non salvato';
          // «salvato» compare un istante e poi svanisce; «non salvato» resta finché non si risolve
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
    editor.element.addEventListener('blur', () => saver.flush());

    const select = h(
      'select',
      { class: 'label-select', 'aria-label': 'Momento della giornata', onchange: () => updateEntry(db, entry.id, { label: select.value || null }).catch(() => toast('Etichetta non salvata.')) },
      h('option', { value: '' }, 'Senza etichetta'),
      LABELS.map((l) => h('option', { value: l }, LABEL_TEXT[l])),
    );
    select.value = entry.label ?? '';

    const root = h(
      'article',
      { class: 'entry' },
      h(
        'header',
        { class: 'entry-head' },
        h('time', { class: 'entry-time' }, entry.time),
        select,
        state,
        h('button', { type: 'button', class: 'icon-btn icon-btn-quiet', 'aria-label': `Elimina la voce delle ${entry.time}`, onclick: () => removeEntry(entry.id) }, icon('trash')),
      ),
      editor.element,
    );
    return { entry, root, saver, editor };
  }

  async function addEntry() {
    try {
      const entry = await createEntry(db, { date, time: timeStr() });
      const view = insertEntry(entry);
      refreshEmpty();
      view.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
      view.editor.focus();
    } catch (err) {
      console.error(err);
      toast('Non riesco a creare la voce.');
    }
  }

  async function removeEntry(id) {
    const view = views.get(id);
    const ok = await confirmDialog({
      title: 'Eliminare questa voce?',
      text: `La voce delle ${view.entry.time} verrà cancellata per sempre. Non si può annullare.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    try {
      await view.saver.close();
      await deleteEntry(db, id);
      view.root.remove();
      views.delete(id);
      refreshEmpty();
    } catch (err) {
      console.error(err);
      toast('Non riesco a eliminare la voce.');
    }
  }

  return {
    async destroy() {
      await Promise.all([...views.values()].map((v) => v.saver.close()));
    },
  };
}
