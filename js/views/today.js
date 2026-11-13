// Pagina "Oggi" (e, con le frecce, qualsiasi altro giorno).

import { firstWrittenDate } from '../archive.js';
import { createSaver } from '../autosave.js';
import { askDataSection, backupReminder, reminderText, snoozeUntil } from '../backup-reminder.js';
import { timeStr, todayStr } from '../dates.js';
import { h, icon, setChildren } from '../dom.js';
import { createEditor } from '../editor.js';
import { get } from '../db.js';
import { LABELS, compareEntries, createEntry, defaultLabel, deleteEntry, isEmptyEntry, listEntriesForDay, restoreEntry, updateEntry } from '../entries.js';
import { pickModuleDialog } from '../moduledialogs.js';
import { NO_DATA_TYPES } from '../modules-catalog.js';
import { setVisibleForDay } from '../modules.js';
import { go } from '../navigation.js';
import { getSettings, saveSettings } from '../settings.js';
import { toast } from '../ui.js';

const UNDO_TIME = 8000; // quanto resta «Annulla» dopo aver eliminato una voce o nascosto un modulo
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
      const keeps = NO_DATA_TYPES.includes(def.type) ? '' : ' Quello che hai scritto resta salvato.';
      toast(`«${def.name}» nascosto per questo giorno.${keeps}`, {
        actionLabel: 'Annulla',
        duration: UNDO_TIME,
        onAction: async () => {
          try {
            await setVisibleForDay(db, date, def.id, true, ctx.enabled);
            await renderModules();
          } catch (err) {
            console.error(err);
            toast('Non riesco a rimettere il modulo: lo ritrovi con «Aggiungi modulo».');
          }
        },
      });
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

  // ----- promemoria del backup: solo nella pagina di oggi, e solo se è passato il tempo scelto nelle impostazioni -----
  async function buildBackupReminder() {
    if (date !== todayStr()) return null;
    try {
      const [settings, firstDate] = await Promise.all([getSettings(db), firstWrittenDate(db)]);
      const due = backupReminder({ settings, today: date, firstDate });
      if (!due) return null;
      const box = h(
        'aside',
        { class: 'notice reminder', 'aria-label': 'Promemoria del backup' },
        h('p', {}, reminderText(due)),
        h(
          'div',
          { class: 'reminder-actions' },
          h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { askDataSection(); go('#/impostazioni', 'tab'); } }, 'Fai il backup'),
          h('button', { type: 'button', class: 'link-button', onclick: () => { box.remove(); saveSettings(db, { backupSnoozeUntil: snoozeUntil(date) }).catch((err) => console.warn('Promemoria non rimandato:', err)); } }, 'Non ora'),
        ),
      );
      return box;
    } catch (err) {
      console.warn('Promemoria del backup non disponibile:', err);
      return null;
    }
  }

  const [loaded, , reminder] = await Promise.all([entriesLoad, renderModules(), buildBackupReminder()]);
  // le voci rimaste vuote (un «Nuova voce» toccato e lasciato lì) non si mostrano e si tolgono
  const entries = loaded.filter((e) => !isEmptyEntry(e));
  for (const e of loaded) if (isEmptyEntry(e)) deleteEntry(db, e.id).catch((err) => console.warn('Voce vuota non tolta:', err));

  const page = h('section', { class: 'page day' }, dayHead(date), dayLinks(date), reminder, topModules, list, empty, addBtn, bottomModules, addModuleBtn);
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

  // Niente domanda «sei sicuro?»: la voce si toglie subito e per qualche secondo si può rimettere con «Annulla».
  async function removeEntry(id) {
    const view = views.get(id);
    try {
      await view.saver.close();
      const saved = await get(db, 'entries', id); // com'è adesso, per poterla rimettere identica
      await deleteEntry(db, id);
      view.root.remove();
      views.delete(id);
      refreshEmpty();
      if (!saved || isEmptyEntry(saved)) return; // una voce vuota: niente da rimettere
      toast('Voce eliminata.', {
        actionLabel: 'Annulla',
        duration: UNDO_TIME,
        onAction: async () => {
          try {
            await restoreEntry(db, saved);
            if (page.isConnected) {
              insertEntry(saved);
              refreshEmpty();
            }
          } catch (err) {
            console.error(err);
            toast('Non riesco a rimettere la voce.');
          }
        },
      });
    } catch (err) {
      console.error(err);
      toast('Non riesco a eliminare la voce.');
    }
  }

  return {
    async destroy() {
      await Promise.all([...views.values()].map((v) => v.saver.close()));
      await Promise.all([...cards].map((c) => c.saver?.close()));
      // uscendo dalla pagina, le voci in cui non è stato scritto niente si tolgono: non contano come scritte
      await Promise.all(
        [...views.values()].filter((v) => isEmptyEntry({ content: v.editor.getMarkdown() })).map((v) => deleteEntry(db, v.entry.id).catch(() => {})),
      );
    },
  };
}
