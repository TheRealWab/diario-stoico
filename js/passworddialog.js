// Finestre per la password del backup cifrato.

import { MIN_PASSWORD_LENGTH } from './crypto-backup.js';
import { h } from './dom.js';

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

/**
 * All'esportazione: scegliere la password (due volte, per evitare errori di battitura) oppure esportare in chiaro.
 * Si risolve con { mode: 'encrypted', password } | { mode: 'plain' } | null (annullato).
 */
export function exportProtectionDialog() {
  return new Promise((resolve) => {
    let result = null;
    const first = passwordField('Password', 'new-password', 'next');
    const second = passwordField('Ripeti la password', 'new-password', 'done');
    const error = h('p', { class: 'form-error', role: 'alert' });
    const okBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, 'Esporta con password');
    const plainBtn = h('button', { type: 'button', class: 'btn btn-danger-outline', onclick: () => ((result = { mode: 'plain' }), dlg.close('ok')) }, 'Esporta senza password');
    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'export-title' },
      h('h2', { class: 'dialog-title', id: 'export-title' }, 'Proteggere il backup?'),
      h('p', { class: 'dialog-text' }, 'Con una password chi trova il file non può leggerlo. Non si può recuperare: se la perdi, il backup è perso.'),
      first.element,
      second.element,
      showToggle([first.input, second.input]),
      h('p', { class: 'hint' }, `Almeno ${MIN_PASSWORD_LENGTH} caratteri: meglio una frase di più parole.`),
      error,
      h('div', { class: 'dialog-actions' }, okBtn, plainBtn, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Annulla')),
    );

    function submit() {
      const a = first.input.value;
      if (a.length < MIN_PASSWORD_LENGTH) {
        error.textContent = `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
        return first.input.focus();
      }
      if (a !== second.input.value) {
        error.textContent = 'Le due password non coincidono.';
        return second.input.focus();
      }
      result = { mode: 'encrypted', password: a };
      dlg.close('ok');
    }
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
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
