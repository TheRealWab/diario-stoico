// Finestre per la password del backup cifrato.

import { MIN_PASSWORD_LENGTH } from './crypto-backup.js';
import { h, setChildren } from './dom.js';

let counter = 0;

function passwordField(label, autocomplete, enterkeyhint = 'done') {
  const id = `pw-${++counter}`;
  const input = h('input', { id, type: 'password', class: 'text-input', autocomplete, enterkeyhint, autocapitalize: 'off', spellcheck: 'false', autocorrect: 'off' });
  // quando compare la tastiera il campo scelto viene portato nella parte visibile della finestra
  input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));
  return { input, element: h('div', { class: 'field-row' }, h('label', { for: id }, label), input) };
}

function showToggle(inputs) {
  const box = h('input', { type: 'checkbox', onchange: () => inputs.forEach((i) => (i.type = box.checked ? 'text' : 'password')) });
  return h('label', { class: 'check-row' }, box, h('span', {}, 'Mostra la password'));
}

function openDialog(dlg, onClose) {
  dlg.addEventListener('close', () => {
    onClose();
    dlg.remove();
  });
  document.body.append(dlg);
  dlg.showModal();
}

const WHERE_KEY = 'ds-backup-where'; // «choose» | «replace»: si ricorda l'ultima scelta (solo comodità, non è nei dati)
const readWherePref = () => {
  try {
    return localStorage.getItem(WHERE_KEY) === 'choose' ? 'choose' : 'replace';
  } catch {
    return 'replace';
  }
};
const saveWherePref = (value) => {
  try {
    localStorage.setItem(WHERE_KEY, value);
  } catch {
    /* facoltativo */
  }
};

/**
 * All'esportazione, tutto in una schermata: con password (due volte, per evitare errori di battitura) o senza,
 * e dove salvare il file. `canChoose`: il telefono sa far scegliere dove salvare. `remembered`: nomi dei file scelti
 * l'ultima volta, { plain, encrypted } (null se non ce n'è), per offrire «Sostituisci il backup precedente».
 * Si risolve con { mode: 'encrypted' | 'plain', password?, where: 'choose' | 'replace' } oppure null (annullato).
 */
export function exportDialog({ canChoose = false, remembered = {} } = {}) {
  return new Promise((resolve) => {
    let result = null;
    let mode = 'encrypted';
    let where = readWherePref();
    const modeName = `export-mode-${++counter}`;
    const whereName = `export-where-${++counter}`;

    const first = passwordField('Password', 'new-password', 'next');
    const second = passwordField('Ripeti la password', 'new-password', 'done');
    const error = h('p', { class: 'form-error', role: 'alert' });
    const passwordBlock = h(
      'div',
      {},
      first.element,
      second.element,
      showToggle([first.input, second.input]),
      h('p', { class: 'hint' }, `Almeno ${MIN_PASSWORD_LENGTH} caratteri: meglio una frase di più parole. Non si può recuperare: se la perdi, il backup è perso.`),
    );
    const plainNote = h('p', { class: 'hint', hidden: true }, 'Senza password il file è testo semplice: chiunque lo trovi può leggere il diario.');

    const modeRadio = (value, text) => {
      const input = h('input', { type: 'radio', name: modeName, value, onchange: () => setMode(value) });
      input.checked = value === mode;
      return h('label', {}, input, h('span', {}, text));
    };
    const modeControl = h('div', { class: 'segmented' }, modeRadio('encrypted', 'Con password'), modeRadio('plain', 'Senza password'));

    // dove salvarlo: si ridisegna quando cambia il tipo di backup (il file ricordato è uno per tipo)
    const whereBlock = h('fieldset', { class: 'field' });
    const effectiveWhere = () => (where === 'replace' && remembered[mode] ? 'replace' : 'choose');
    function paintWhere() {
      if (!canChoose) {
        whereBlock.replaceChildren(h('p', { class: 'hint' }, 'Su questo telefono il file viene salvato nella cartella Download.'));
        return;
      }
      const choice = (value, title, sub) => {
        const input = h('input', { type: 'radio', name: whereName, value, onchange: () => (where = value) });
        input.checked = effectiveWhere() === value;
        return h('label', { class: 'choice' }, input, h('span', {}, h('strong', {}, title), h('small', {}, sub)));
      };
      setChildren(
        whereBlock,
        h('legend', {}, 'Dove salvarlo'),
        choice('choose', 'Scegli dove salvare', 'Si apre la scelta della cartella e del nome del file'),
        remembered[mode] ? choice('replace', 'Sostituisci il backup precedente', `«${remembered[mode]}» viene sostituito: terrai un solo file`) : null,
      );
    }
    function setMode(value) {
      mode = value;
      passwordBlock.hidden = mode !== 'encrypted';
      plainNote.hidden = mode !== 'plain';
      error.textContent = '';
      paintWhere();
    }
    paintWhere();

    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'export-title' },
      h('h2', { class: 'dialog-title', id: 'export-title' }, 'Salvare il backup'),
      modeControl,
      passwordBlock,
      plainNote,
      whereBlock,
      error,
      h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, 'Crea e salva il backup'), h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Annulla')),
    );

    function submit() {
      const finalWhere = effectiveWhere();
      if (mode === 'plain') {
        result = { mode, where: finalWhere };
      } else {
        const a = first.input.value;
        if (a.length < MIN_PASSWORD_LENGTH) {
          error.textContent = `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
          return first.input.focus();
        }
        if (a !== second.input.value) {
          error.textContent = 'Le due password non coincidono.';
          return second.input.focus();
        }
        result = { mode, password: a, where: finalWhere };
      }
      if (canChoose && remembered[mode]) saveWherePref(finalWhere);
      dlg.close('ok');
    }
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.target === first.input || e.target === second.input)) {
        e.preventDefault();
        if (e.target === first.input) second.input.focus(); // «Succ.» della tastiera: passa al secondo campo
        else submit();
      }
    });
    openDialog(dlg, () => resolve(dlg.returnValue === 'ok' ? result : null));
  });
}

/**
 * All'importazione di un file cifrato: chiede la password. `work(password)` prova ad aprire il file e
 * restituisce { ok: true, value } oppure { ok: false, message }. Si risolve con il value, o null se si annulla.
 */
export function askPasswordDialog({ title = 'Backup protetto', text = 'Inserisci la password scelta quando hai esportato questo backup.', work }) {
  return new Promise((resolve) => {
    let value = null;
    const field = passwordField('Password', 'current-password');
    const error = h('p', { class: 'form-error', role: 'alert' });
    const okBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, 'Apri il backup');
    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'ask-title' },
      h('h2', { class: 'dialog-title', id: 'ask-title' }, title),
      h('p', { class: 'dialog-text' }, text),
      field.element,
      showToggle([field.input]),
      error,
      h('div', { class: 'dialog-actions' }, okBtn, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Annulla')),
    );

    async function submit() {
      if (!field.input.value || okBtn.disabled) return;
      okBtn.disabled = true;
      okBtn.textContent = 'Attendi…';
      error.textContent = '';
      const result = await work(field.input.value);
      okBtn.disabled = false;
      okBtn.textContent = 'Apri il backup';
      if (result.ok) {
        value = result.value;
        dlg.close('ok');
      } else {
        error.textContent = result.message;
        field.input.select();
      }
    }
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
        e.preventDefault();
        submit();
      }
    });
    openDialog(dlg, () => resolve(dlg.returnValue === 'ok' ? value : null));
  });
}
