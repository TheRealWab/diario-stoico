// Pagina "Impostazioni": aspetto, backup e informazioni.

import { applyAppearance } from '../appearance.js';
import { backupText, buildExport, downloadJson, exportFilename, importData, planMerge, validateImport } from '../backup.js';
import { daysAgoLabel, formatDayMonthYear, todayStr } from '../dates.js';
import { h } from '../dom.js';
import { getSettings, saveSettings } from '../settings.js';
import { flushAll } from '../autosave.js';
import { KINDS, canReuseFile, fileChoiceAvailable, forgetFile, getRememberedFile, pickNewFile, rememberFile, writeToFile } from '../file-backup.js';
import { BackupCryptoError, decryptBackup, encryptBackup, isEncryptedBackup } from '../crypto-backup.js';
import { askPasswordDialog, exportProtectionDialog } from '../passworddialog.js';
import { changePin, disableLock, enableLock, toggleFingerprint } from '../lockflow.js';
import { isLockActive } from '../lockstate.js';
import { confirmDialog, messageDialog, showDialog, toast } from '../ui.js';
import { APP_VERSION } from '../util.js';
import { fingerprintAvailable } from '../webauthn.js';

const THEME_OPTIONS = [['carta', 'Carta'], ['scuro', 'Scuro'], ['sistema', 'Sistema']];
const FONT_OPTIONS = [['serif', 'Serif (da libro)'], ['sans', 'Sans (pulito)']];
const SIZE_OPTIONS = [['s', 'Piccola'], ['m', 'Media'], ['l', 'Grande'], ['xl', 'Molto grande']];
const SPACING_OPTIONS = [['s', 'Compatta'], ['m', 'Normale'], ['l', 'Ampia'], ['xl', 'Molto ampia']];

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
  const fingerprintOffered = await fingerprintAvailable();

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

  /**
   * Dove scrivere il backup, dove il browser lo permette: il file della volta prima (da sostituire) oppure uno
   * scelto con la finestra di sistema. Va fatto subito dopo un tocco, prima del lavoro lungo (la cifratura).
   * Restituisce { cancelled: true } se si annulla, { handle: null } se si ripiega sul download.
   */
  async function chooseTarget(kind, name) {
    if (!fileChoiceAvailable()) return { handle: null, replacing: false };
    const previous = await getRememberedFile(kind);
    if (previous) {
      const answer = await showDialog({
        title: 'Dove salvare il backup?',
        body: [h('p', {}, `L’ultima volta l’hai salvato in «${previous.name}».`), h('p', { class: 'hint' }, 'Sostituendolo tieni un solo file, senza doppioni.')],
        actions: [
          { label: 'Sostituisci il backup precedente', value: 'replace', kind: 'primary' },
          { label: 'Scegli un’altra posizione', value: 'choose', kind: 'secondary' },
          { label: 'Annulla', value: 'cancel', kind: 'ghost' },
        ],
      });
      if (answer !== 'replace' && answer !== 'choose') return { cancelled: true };
      if (answer === 'replace') {
        if (await canReuseFile(previous)) return { handle: previous, replacing: true };
        await forgetFile(kind);
        toast('Il file di prima non si trova più: scegli dove salvare.');
      }
    }
    try {
      return { handle: await pickNewFile(name), replacing: false };
    } catch (err) {
      if (err?.name === 'AbortError') return { cancelled: true }; // ha chiuso la finestra senza scegliere: non cambia nulla
      console.warn('Scelta del file non riuscita, si usa il download:', err);
      return { handle: null, replacing: false };
    }
  }

  async function doExport() {
    const choice = await exportProtectionDialog();
    if (!choice) return;
    const encrypted = choice.mode === 'encrypted';
    const name = exportFilename(new Date(), { encrypted });
    const kind = encrypted ? KINDS.encrypted : KINDS.plain;
    try {
      const target = await chooseTarget(kind, name);
      if (target.cancelled) return;
      await flushAll();
      const file = await buildExport(db);
      let out = file;
      if (encrypted) {
        toast('Cifro il backup…', { sticky: true });
        out = await encryptBackup(file, choice.password);
        // prova subito a riaprirlo: un backup che poi non si apre sarebbe peggio di nessun backup
        const check = await decryptBackup(out, choice.password);
        if (check.exportedAt !== file.exportedAt) throw new Error('verifica del backup cifrato non riuscita');
      }
      let where;
      if (target.handle) {
        try {
          await writeToFile(target.handle, backupText(out));
        } catch (err) {
          console.error(err);
          toast('Non sono riuscito a scrivere il file. Riprova, magari scegliendo un’altra posizione.');
          return;
        }
        await rememberFile(kind, target.handle);
        where = `${target.replacing ? 'sostituito' : 'salvato'}: «${target.handle.name}»`;
      } else {
        downloadJson(out, name);
        where = 'salvato nella cartella Download';
      }
      settings = await getSettings(db);
      refreshBackupNote();
      toast(`${encrypted ? 'Backup cifrato' : 'Backup'} ${where}${encrypted ? '' : ' (senza password)'}.`);
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
    if (isEncryptedBackup(parsed)) {
      // backup cifrato: serve la password; si può riprovare quante volte si vuole
      const original = parsed;
      parsed = await askPasswordDialog({
        work: async (password) => {
          try {
            return { ok: true, value: await decryptBackup(original, password) };
          } catch (err) {
            return { ok: false, message: err instanceof BackupCryptoError ? err.message : 'Non riesco ad aprire il file.' };
          }
        },
      });
      if (parsed === null) return;
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

  // ----- blocco -----
  const lockOn = isLockActive(settings);
  const rerender = () => mountSettings({ db, container });
  const run = (flow) => async () => {
    try {
      await flow({ db, doExport });
    } catch (err) {
      console.error(err);
      toast('Qualcosa non ha funzionato. Il blocco non è stato modificato.');
    }
    await rerender();
  };

  function lockGroup() {
    const status = lockOn
      ? settings.webauthn
        ? 'Attivo: si apre con l’impronta; il PIN è la riserva se l’impronta non viene riconosciuta.'
        : 'Attivo: si apre con il PIN.'
      : 'Disattivato. Attivandolo, il diario chiede l’impronta o il PIN quando lo apri.';
    return h(
      'section',
      { class: 'group' },
      h('h2', {}, 'Blocco'),
      h('p', { class: 'hint' }, status),
      lockOn
        ? [
            h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: run(changePin) }, 'Cambia PIN')),
            fingerprintOffered || settings.webauthn
              ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: run(toggleFingerprint) }, settings.webauthn ? 'Non usare più l’impronta' : 'Usa anche l’impronta'))
              : null,
            h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-secondary btn-danger-outline', onclick: run(disableLock) }, 'Disattiva il blocco')),
          ]
        : h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: run(enableLock) }, 'Attiva il blocco')),
      h('p', { class: 'hint' }, 'Il blocco tiene lontano chi prende in mano il telefono: non cifra i dati. Il PIN non si può recuperare.'),
    );
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
      segmented({ legend: 'Spazio tra le righe', options: SPACING_OPTIONS, value: settings.lineSpacing, onChange: (v) => change({ lineSpacing: v }) }),
      h('p', { class: 'preview', 'aria-hidden': 'true' }, 'Scrivere ogni giorno è un modo semplice per capire cosa dipende da noi e cosa no. Quello che conta è tornare a farlo, anche con poche righe, anche nei giorni difficili.'),
    ),

    lockGroup(),

    h(
      'section',
      { class: 'group' },
      h('h2', {}, 'Dati'),
      h('p', { class: 'hint' }, 'Il diario vive solo su questo telefono. Un backup ogni tanto ti protegge se lo perdi o lo cambi.'),
      fileChoiceAvailable() ? h('p', { class: 'hint' }, 'Puoi scegliere dove salvare il backup e, le volte dopo, sostituire quello precedente: resta un solo file, senza doppioni.') : null,
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
