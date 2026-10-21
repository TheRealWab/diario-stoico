// Pagina "Oggi" (e, con le frecce, qualsiasi altro giorno).

import { createSaver } from '../autosave.js';
import { timeStr } from '../dates.js';
import { h, icon, setChildren } from '../dom.js';
import { createEditor } from '../editor.js';
import { LABELS, compareEntries, createEntry, defaultLabel, deleteEntry, listEntriesForDay, updateEntry } from '../entries.js';
import { pickModuleDialog } from '../moduledialogs.js';
import { setVisibleForDay } from '../modules.js';
import { go } from '../navigation.js';
import { confirmDialog, toast } from '../ui.js';
import { loadDayModules } from './daymodules.js';
import { dayHead, dayLinks } from './dayhead.js';
import { moduleCard } from './modulecard.js';
import { buildStrip } from './strip.js';

const LABEL_TEXT = { mattina: 'Mattina', giorno: 'Giorno', sera: 'Sera' };

export async function mountToday({ db, container, date }) {
  const entriesLoad = listEntriesForDay(db, date); // parte subito, in parallelo ai moduli
  const views = new Map(); // id -> { entry, root, saver, editor }

  const list = h('div', { class: 'entries' });
  const empty = h('p', { class: 'empty' }, 'Una pagina bianca. Scrivi quando vuoi, anche una sola riga.');
  const addBtn = h('button', { type: 'button', class: 'btn btn-add', onclick: addEntry }, icon('plus'), 'Nuova voce');

  // ----- moduli: alcuni sopra le voci, altri sotto; «Aggiungi modulo» in fondo -----
  const topModules = h('div', { class: 'modules' });
  const bottomModules = h('div', { class: 'modules' });
  const addModuleBtn = h('button', { type: 'button', class: 'link-button add-module', onclick: addModule }, '+ Aggiungi modulo');
  const cards = new Set(); // i riquadri con dati da salvare: { saver }
  let ctx = null;

  async function renderModules() {
    await Promise.all([...cards].map((c) => c.saver?.close())); // quel che si stava scrivendo si salva prima di ridisegnare
    cards.clear();
    ctx = await loadDayModules(db, date);
    const build = async (def) => {
      const onHide = () => hideModule(def);
      if (def.type === 'goals') return buildStrip({ db, date, onHide });
      const card = moduleCard({ db, def, date, instance: ctx.instances.get(def.id), onHide });
      cards.add(card);
      return card.element;
    };
    const [top, bottom] = await Promise.all(['top', 'bottom'].map((slot) => Promise.all(ctx.visible.filter((d) => d.slot === slot).map(build))));
    setChildren(topModules, top);
    setChildren(bottomModules, bottom);
  }

  async function hideModule(def) {
    try {
      await setVisibleForDay(db, date, def.id, false, ctx.enabled);
      await renderModules();
      toast(`«${def.name}» nascosto per questo giorno. Quello che hai scritto resta salvato: lo ritrovi con «Aggiungi modulo».`);
    } catch (err) {
      console.error(err);
      toast('Non riesco a nascondere il modulo.');
    }
  }

  async function addModule() {
    const choice = await pickModuleDialog({ available: ctx.available, withData: ctx.withData });
    if (!choice) return;
    if (choice === 'settings') return go('#/impostazioni', 'tab');
    try {
      await setVisibleForDay(db, date, choice, true, ctx.enabled);
      await renderModules();
      page.querySelector(`[data-module="${CSS.escape(choice)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      toast('Non riesco ad aggiungere il modulo.');
    }
  }

  const [entries] = await Promise.all([entriesLoad, renderModules()]);

  const page = h('section', { class: 'page day' }, dayHead(date), dayLinks(date), topModules, list, empty, addBtn, bottomModules, addModuleBtn);
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
      label: 'Voce del diario',
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
        select,
        state,
        h('button', { type: 'button', class: 'icon-btn icon-btn-quiet', 'aria-label': 'Elimina questa voce', onclick: () => removeEntry(entry.id) }, icon('trash')),
      ),
      editor.element,
    );
    return { entry, root, saver, editor };
  }

  async function addEntry() {
    try {
      const time = timeStr();
      const entry = await createEntry(db, { date, time, label: defaultLabel(time) });
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
      text: 'La voce verrà cancellata per sempre. Non si può annullare.',
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
      await Promise.all([...cards].map((c) => c.saver?.close()));
    },
  };
}
