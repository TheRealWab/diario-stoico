// Pagina "Impostazioni": aspetto, backup e informazioni.

import { applyAppearance } from '../appearance.js';
import { buildExport, downloadJson, exportFilename, importData, planMerge, validateImport } from '../backup.js';
import { daysAgoLabel, formatDayMonthYear, todayStr } from '../dates.js';
import { h } from '../dom.js';
import { getSettings, saveSettings } from '../settings.js';
import { flushAll } from '../autosave.js';
import { confirmDialog, messageDialog, showDialog, toast } from '../ui.js';
import { APP_VERSION } from '../util.js';

const THEME_OPTIONS = [['carta', 'Carta'], ['scuro', 'Scuro'], ['sistema', 'Sistema']];
const FONT_OPTIONS = [['serif', 'Serif (da libro)'], ['sans', 'Sans (pulito)']];
const SIZE_OPTIONS = [['s', 'Piccola'], ['m', 'Media'], ['l', 'Grande'], ['xl', 'Molto grande']];

let groupCounter = 0;

function segmented({ legend, options, value, onChange }) {
  const name = `seg-${++groupCounter}`;
  return h(
    'fieldset',
    { class: 'field' },
    h('legend', {}, legend),
    h(
      'div',
      { class: 'segmented' },
      options.map(([val, text]) => {
        const input = h('input', { type: 'radio', name, value: val, onchange: () => onChange(val) });
        input.checked = val === value;
        return h('label', {}, input, h('span', {}, text));
      }),
    ),
  );
}

export async function mountSettings({ db, container }) {
  let settings = await getSettings(db);
  const persisted = (await navigator.storage?.persisted?.()) ?? false;

  async function change(patch) {
    try {
      settings = await saveSettings(db, patch);
      applyAppearance(settings);
    } catch (err) {
      console.error(err);
      toast('Impostazione non salvata.');
    }
  }

  const backupNote = h('p', { class: 'hint', id: 'backup-note' });
  const refreshBackupNote = () => {
    backupNote.textContent = `ultimo backup: ${daysAgoLabel(settings.lastBackupDate, todayStr())}`;
  };
  refreshBackupNote();

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: () => onFilePicked(fileInput) });

  async function doExport() {
    try {
      await flushAll();
      const file = await buildExport(db);
      downloadJson(file, exportFilename());
      settings = await getSettings(db);
      refreshBackupNote();
      toast('Backup salvato nella cartella Download.');
    } catch (err) {
      console.error(err);
      toast('Non sono riuscito a creare il backup.');
    }
  }

  async function onFilePicked(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      await messageDialog({ title: 'File non valido', text: 'Questo file non è un backup leggibile. I tuoi dati non sono stati toccati.' });
      return;
    }
    const check = validateImport(parsed);
    if (!check.ok) {
      await messageDialog({
        title: 'File non valido',
        text: 'Il backup non può essere importato. I tuoi dati non sono stati toccati.',
        items: check.errors.slice(0, 5),
      });
      return;
    }
    await flushAll();
    const { summary, data } = check;
    const plan = await planMerge(db, data);
    const { from, to } = summary.entries;
    const period = !summary.entries.count
      ? ''
      : from === to
        ? `del ${formatDayMonthYear(from)}`
        : `dal ${formatDayMonthYear(from)} al ${formatDayMonthYear(to)}`;
    const choice = await showDialog({
      title: 'Importare questo backup?',
      body: [
        h('p', {}, `Il file contiene ${summary.entries.count} ${summary.entries.count === 1 ? 'voce' : 'voci'}${period ? ` ${period}` : ''}.`),
        h('p', {}, `Unendo: ${plan.added} nuove, ${plan.updated} aggiornate, ${plan.unchanged} già presenti e invariate.`),
        h('p', { class: 'hint' }, 'Finché non scegli, non cambia nulla.'),
      ],
      actions: [
        { label: 'Unisci ai dati attuali', value: 'merge', kind: 'primary' },
        { label: 'Sostituisci tutto', value: 'replace', kind: 'danger-outline' },
        { label: 'Annulla', value: 'cancel', kind: 'ghost' },
      ],
    });
    if (choice !== 'merge' && choice !== 'replace') return;
    if (choice === 'replace') {
      const ok = await confirmDialog({
        title: 'Sostituire tutto?',
        text: 'Il diario che c’è ora su questo telefono verrà cancellato e sostituito con quello del file. Se non hai un backup recente, esportalo prima.',
        confirmLabel: 'Sì, sostituisci',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await importData(db, data, choice);
      settings = await getSettings(db);
      applyAppearance(settings);
      toast('Importazione completata.');
      await mountSettings({ db, container }); // ridisegna con i valori importati
    } catch (err) {
      console.error(err);
      await messageDialog({ title: 'Importazione non riuscita', text: 'Qualcosa è andato storto. I tuoi dati non sono stati modificati.' });
    }
  }

  const page = h(
    'section',
    { class: 'page settings' },
    h('h1', { class: 'page-title' }, 'Impostazioni'),

    h(
      'section',
      { class: 'group' },
      h('h2', {}, 'Aspetto'),
      segmented({ legend: 'Tema', options: THEME_OPTIONS, value: settings.theme, onChange: (v) => change({ theme: v }) }),
      segmented({ legend: 'Carattere del diario', options: FONT_OPTIONS, value: settings.font, onChange: (v) => change({ font: v }) }),
      segmented({ legend: 'Dimensione del testo', options: SIZE_OPTIONS, value: settings.fontSize, onChange: (v) => change({ fontSize: v }) }),
      h('p', { class: 'preview', 'aria-hidden': 'true' }, 'Scrivere ogni giorno è un modo semplice per capire cosa dipende da noi e cosa no.'),
    ),

    h(
      'section',
      { class: 'group' },
      h('h2', {}, 'Dati'),
      h('p', { class: 'hint' }, 'Il diario vive solo su questo telefono. Un backup ogni tanto ti protegge se lo perdi o lo cambi.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: doExport }, 'Esporta backup (JSON)'), backupNote),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => fileInput.click() }, 'Importa da file…'), fileInput),
    ),

    h(
      'section',
      { class: 'group' },
      h('h2', {}, 'Informazioni'),
      h('p', { class: 'hint' }, `Diario Stoico · versione ${APP_VERSION}`),
      h('p', { class: 'hint' }, persisted ? 'Archiviazione protetta dal browser: sì.' : 'Archiviazione protetta dal browser: non ancora (si attiva di solito dopo l’installazione).'),
    ),
  );
  container.replaceChildren(page);
  return { destroy() {} };
}
