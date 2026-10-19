// Finestre dei moduli: aggiungerne uno a un giorno, crearne o modificarne uno tuo, scegliere un modello pronto.

import { h } from './dom.js';
import { closeBtn, present, selectField, textArea, textField } from './goaldialogs.js';
import { CUSTOM_TYPES, CUSTOM_TYPE_LABEL, LIMITS, TEMPLATES } from './modules-catalog.js';

let counter = 0;

/** Una finestra con un elenco di scelte (ogni scelta è un pulsante con titolo e riga di spiegazione). */
function choiceDialog({ title, text, choices, extraActions = [] }) {
  return new Promise((resolve) => {
    const titleId = `module-pick-${++counter}`;
    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId },
      h('h2', { class: 'dialog-title', id: titleId }, title),
      text ? h('p', { class: 'dialog-text' }, text) : null,
      choices.length
        ? h(
            'div',
            { class: 'pick-list' },
            choices.map((c) => h('button', { type: 'button', class: 'pick', onclick: () => dlg.close(c.value) }, h('strong', {}, c.title), h('small', {}, c.sub))),
          )
        : null,
      h('div', { class: 'dialog-actions' }, ...extraActions.map((a) => h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => dlg.close(a.value) }, a.label)), h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Chiudi')),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue || null);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/**
 * «+ Aggiungi modulo» in un giorno. `available`: i moduli non visibili quel giorno; `withData`: id di quelli che hanno già
 * qualcosa di scritto. Si risolve con l'id scelto, con 'settings' (per gestire i moduli) o con null.
 */
export function pickModuleDialog({ available, withData = new Set() }) {
  return choiceDialog({
    title: 'Aggiungi un modulo',
    text: available.length ? 'Scegli un modulo per questo giorno. Quello che scrivi resta salvato anche se poi lo nascondi.' : 'Tutti i moduli sono già in questa giornata.',
    choices: available.map((d) => ({ value: d.id, title: d.name, sub: `${d.blurb || 'Un modulo tuo.'}${withData.has(d.id) ? ' Qui ha già dei contenuti.' : ''}` })),
    extraActions: [{ label: 'Gestisci i moduli', value: 'settings' }],
  });
}

/** Un modello pronto da aggiungere ai tuoi moduli. Si risolve con la chiave del modello o con null. */
export function templatePickerDialog() {
  return choiceDialog({
    title: 'Modelli pronti',
    text: 'Nascono come moduli tuoi, spenti: li accendi dalle impostazioni quando vuoi, e puoi cambiarne il nome o archiviarli.',
    choices: TEMPLATES.map((t) => ({ value: t.key, title: t.name, sub: `${t.blurb} «${t.prompt}»` })),
  });
}

/**
 * Crea o modifica un modulo tuo. Con `def` si modificano solo nome e frase-guida (il tipo e le opzioni restano come sono,
 * per non rendere illeggibili i dati già scritti). Si risolve con { name, prompt, type, options } oppure con null.
 */
export function moduleFormDialog({ def = null } = {}) {
  const editing = !!def;
  const nameField = textField('Nome', { maxlength: LIMITS.name, value: def?.name ?? '', enterkeyhint: 'next', placeholder: 'Per esempio: Gratitudine' });
  const promptField = textField('Frase-guida (facoltativa)', { maxlength: LIMITS.prompt, value: def?.prompt ?? '', enterkeyhint: 'done', placeholder: 'Una domanda o un invito' });
  const typeField = selectField('Che cosa si scrive', CUSTOM_TYPES.map((t) => [t, CUSTOM_TYPE_LABEL[t]]), def?.type ?? 'text');
  const optionsField = textArea('Opzioni (una per riga, da 2 a 8)', { rows: '4', maxlength: String(LIMITS.optionsMax * (LIMITS.option + 1)), placeholder: 'calmo\nveloce' });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const showOptions = () => (optionsField.element.hidden = typeField.select.value !== 'choice');
  typeField.select.addEventListener('change', showOptions);
  showOptions();

  const dlg = h(
    'dialog',
    { class: 'dialog', 'aria-label': editing ? 'Modifica il modulo' : 'Nuovo modulo' },
    h('h2', { class: 'dialog-title' }, editing ? 'Modifica il modulo' : 'Nuovo modulo'),
    nameField.element,
    promptField.element,
    editing ? h('p', { class: 'hint' }, `Tipo: ${CUSTOM_TYPE_LABEL[def.type]}. Non si cambia, per non rendere illeggibile ciò che hai già scritto.`) : [typeField.element, optionsField.element],
    error,
    h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: submit }, editing ? 'Salva' : 'Crea il modulo'), closeBtn(() => dlg, 'Annulla')),
  );
  const options = () => optionsField.input.value.split('\n').map((o) => o.trim()).filter(Boolean);
  function submit() {
    if (!nameField.input.value.trim()) {
      error.textContent = 'Scrivi un nome per il modulo.';
      return nameField.input.focus();
    }
    if (!editing && typeField.select.value === 'choice') {
      const list = options();
      if (list.length < 2 || list.length > LIMITS.optionsMax || new Set(list).size !== list.length || list.some((o) => o.length > LIMITS.option)) {
        error.textContent = `Servono da 2 a ${LIMITS.optionsMax} opzioni diverse, di al massimo ${LIMITS.option} caratteri.`;
        return optionsField.input.focus();
      }
    }
    dlg.close('ok');
  }
  nameField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      promptField.input.focus();
    }
  });
  promptField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  return present(dlg, () => ({
    name: nameField.input.value,
    prompt: promptField.input.value,
    type: editing ? def.type : typeField.select.value,
    options: editing ? def.options : typeField.select.value === 'choice' ? options() : [],
  }));
}
