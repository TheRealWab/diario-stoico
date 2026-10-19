// Il contenuto dei moduli: come si compilano (modifica) e come si leggono (sola lettura).
// Ogni tipo lavora su dati già ripuliti da normalizeData; ad ogni cambiamento chiama onChange con una copia dei dati.
// Il testo dell'utente entra nella pagina solo come testo (h() non usa mai HTML).

import { h, setChildren } from '../dom.js';
import { ENERGY_WORDS, EVENING_FOOTNOTE, EVENING_VARIANTS, LIMITS, MOOD_WORDS, VIRTUES } from '../modules-catalog.js';
import { isEmptyData, normalizeData } from '../modules.js';
import { toast } from '../ui.js';

let counter = 0;
const uid = () => `mb-${++counter}`;
const copy = (value) => JSON.parse(JSON.stringify(value));
const virtueName = (id) => VIRTUES.find((v) => v.id === id)?.name ?? id;

// ---------- pezzi comuni ----------

// quando compare la tastiera il campo scelto viene portato nella parte visibile
const scrollOnFocus = (el) => el.addEventListener('focus', () => setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300));

function area({ label = '', ariaLabel = '', value, onInput, rows = 3, max = LIMITS.text, placeholder = '' }) {
  const id = uid();
  const ta = h('textarea', { id, class: 'text-input text-area mod-area', rows, maxlength: max, placeholder, 'aria-label': label ? null : ariaLabel || null }, value);
  ta.addEventListener('input', () => onInput(ta.value));
  scrollOnFocus(ta);
  return h('div', { class: 'field-row' }, label ? h('label', { for: id }, label) : null, ta);
}

function line({ label, value, onInput, max = LIMITS.line, placeholder = '' }) {
  const id = uid();
  const input = h('input', { id, type: 'text', class: 'text-input', maxlength: max, value, placeholder, autocomplete: 'off', enterkeyhint: 'done' });
  input.addEventListener('input', () => onInput(input.value));
  scrollOnFocus(input);
  return h('div', { class: 'field-row' }, h('label', { for: id }, label), input);
}

const chip = (text, pressed, onclick, extra = {}) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), onclick, ...extra }, text);

/** Una fila di pulsanti a scelta singola o multipla. Il pulsante già scelto, se si tocca ancora, si deseleziona. */
function chipRow(labels, isOn, toggle) {
  const row = h('div', { class: 'chips' });
  const paint = () => setChildren(row, labels.map((text, i) => chip(text, isOn(i), () => { toggle(i); paint(); })));
  paint();
  return row;
}

const group = (legend, ...children) => h('fieldset', { class: 'mod-group' }, h('legend', {}, legend), ...children);

// ---------- modifica ----------

const EDIT = {
  text: ({ def, state, emit }) => area({ ariaLabel: def.name, value: state.text, rows: 4, onInput: (v) => ((state.text = v), emit()) }),

  checklist({ state, emit }) {
    const list = h('ul', { class: 'mod-items' });
    const input = h('input', { type: 'text', class: 'text-input', maxlength: LIMITS.line, placeholder: 'Aggiungi una voce', 'aria-label': 'Nuova voce dell’elenco', enterkeyhint: 'done', autocomplete: 'off' });
    scrollOnFocus(input);
    const form = h('form', { class: 'mod-add' }, input, h('button', { type: 'submit', class: 'btn btn-secondary' }, 'Aggiungi'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (state.items.length >= LIMITS.itemsMax) return toast(`Un elenco può avere al massimo ${LIMITS.itemsMax} voci.`);
      state.items.push({ text, done: false });
      input.value = '';
      paint();
      emit();
      input.focus();
    });
    function remove(index) {
      const [gone] = state.items.splice(index, 1);
      paint();
      emit();
      toast('Voce tolta.', {
        actionLabel: 'Annulla',
        onAction: () => {
          state.items.splice(index, 0, gone);
          paint();
          emit();
        },
      });
    }
    function paint() {
      setChildren(
        list,
        state.items.map((item, i) =>
          h(
            'li',
            { class: 'mod-item' },
            h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: item.done, onchange: (e) => ((item.done = e.target.checked), emit()) }), h('span', {}, item.text)),
            h('button', { type: 'button', class: 'icon-btn icon-btn-quiet', 'aria-label': `Togli dall’elenco: ${item.text}`, onclick: () => remove(i) }, '×'),
          ),
        ),
      );
    }
    paint();
    return h('div', {}, list, form);
  },

  rating: ({ state, emit }) =>
    h(
      'div',
      {},
      chipRow(['1', '2', '3', '4', '5'], (i) => state.value === i + 1, (i) => ((state.value = state.value === i + 1 ? null : i + 1), emit())),
      h('p', { class: 'hint mod-scale' }, 'Da 1 (poco) a 5 (molto).'),
    ),

  choice: ({ def, state, emit }) => chipRow(def.options, (i) => state.value === def.options[i], (i) => ((state.value = state.value === def.options[i] ? null : def.options[i]), emit())),

  premeditatio({ state, emit }) {
    const root = h('div', { class: 'mod-cases' });
    const addBtn = h('button', { type: 'button', class: 'link-button', onclick: () => ((state.cases.push({ event: '', response: '' }), paint(), emit())) }, '+ Un altro caso');
    function paint() {
      setChildren(
        root,
        state.cases.map((c, i) =>
          h(
            'div',
            { class: 'mod-case' },
            line({ label: 'Se… (che cosa potrebbe andare storto)', value: c.event, onInput: (v) => ((c.event = v), emit()) }),
            area({ label: 'allora io… (come risponderò)', value: c.response, rows: 2, max: LIMITS.line, onInput: (v) => ((c.response = v), emit()) }),
            state.cases.length > 1 && !c.event.trim() && !c.response.trim()
              ? h('button', { type: 'button', class: 'link-button', onclick: () => ((state.cases.splice(i, 1), paint(), emit())) }, 'Togli questo caso vuoto')
              : null,
          ),
        ),
        state.cases.length < LIMITS.casesMax ? addBtn : null,
      );
    }
    paint();
    return root;
  },

  negvis: ({ state, emit }) =>
    h(
      'div',
      {},
      area({ label: 'Che cosa immagino di perdere?', value: state.imagine, onInput: (v) => ((state.imagine = v), emit()) }),
      area({ label: 'Che cosa apprezzo di più, adesso?', value: state.appreciate, onInput: (v) => ((state.appreciate = v), emit()) }),
    ),

  virtues({ state, emit }) {
    const toggle = (key, id) => {
      state[key] = state[key].includes(id) ? state[key].filter((x) => x !== id) : [...state[key], id];
      emit();
    };
    const rows = VIRTUES.map((v) => {
      const buttons = h('div', { class: 'chips' });
      const paint = () =>
        setChildren(buttons, [
          chip('Esercitata', state.exercised.includes(v.id), () => (toggle('exercised', v.id), paint()), { 'aria-label': `${v.name}: esercitata oggi` }),
          chip('Da curare', state.missed.includes(v.id), () => (toggle('missed', v.id), paint()), { 'aria-label': `${v.name}: da curare` }),
        ]);
      paint();
      return h('div', { class: 'mod-virtue' }, h('p', { class: 'mod-virtue-name' }, h('strong', {}, v.name), h('span', {}, ` — ${v.hint}`)), buttons);
    });
    return h('div', {}, ...rows, area({ label: 'Una riga (facoltativa)', value: state.note, rows: 2, onInput: (v) => ((state.note = v), emit()) }));
  },

  control: ({ state, emit }) =>
    h(
      'div',
      {},
      line({ label: 'Il momento', value: state.episode, placeholder: 'Una riunione, una telefonata…', onInput: (v) => ((state.episode = v), emit()) }),
      area({ label: 'Dipende da me', value: state.mine, onInput: (v) => ((state.mine = v), emit()) }),
      area({ label: 'Non dipende (del tutto) da me', value: state.notmine, onInput: (v) => ((state.notmine = v), emit()) }),
      h('p', { class: 'hint' }, 'Il tuo impegno dipende da te; il risultato spesso no.'),
    ),

  mood: ({ state, emit }) =>
    h(
      'div',
      {},
      group('Umore', chipRow(MOOD_WORDS, (i) => state.mood === i + 1, (i) => ((state.mood = state.mood === i + 1 ? null : i + 1), emit()))),
      group('Energia', chipRow(ENERGY_WORDS, (i) => state.energy === i + 1, (i) => ((state.energy = state.energy === i + 1 ? null : i + 1), emit()))),
    ),

  evening({ state, emit }) {
    const variantOf = () => EVENING_VARIANTS.find((v) => v.id === state.variant) ?? EVENING_VARIANTS[0];
    const name = `evening-${++counter}`;
    const questions = h('div', {});
    const chosen = h('p', { class: 'hint' });
    const selector = h(
      'div',
      { class: 'segmented' },
      EVENING_VARIANTS.map((v) => {
        const input = h('input', { type: 'radio', name, value: v.id, onchange: () => ((state.variant = v.id), paintQuestions(), emit()) });
        input.checked = v.id === state.variant;
        return h('label', {}, input, h('span', {}, v.name));
      }),
    );
    function refreshChoice() {
      // si può scegliere la versione finché non si è scritto nulla; poi resta quella
      const empty = isEmptyData('evening', state);
      selector.hidden = !empty;
      chosen.hidden = empty;
      chosen.textContent = variantOf().name;
    }
    function paintQuestions() {
      setChildren(
        questions,
        variantOf().questions.map((q, i) => area({ label: q, value: state.answers[i], rows: 3, onInput: (v) => ((state.answers[i] = v), refreshChoice(), emit()) })),
      );
    }
    paintQuestions();
    refreshChoice();
    return h('div', {}, selector, chosen, questions, h('p', { class: 'hint' }, EVENING_FOOTNOTE));
  },
};

// ---------- sola lettura ----------

const readBlock = (label, text) => (text && text.trim() ? h('div', { class: 'mod-read' }, label ? h('p', { class: 'mod-read-label' }, label) : null, h('p', { class: 'mod-read-text' }, text)) : null);

const READ = {
  text: ({ state }) => readBlock('', state.text),
  checklist: ({ state }) =>
    h('ul', { class: 'mod-read-list' }, state.items.map((i) => h('li', { class: i.done ? 'is-done' : '' }, h('span', { class: 'mod-mark', 'aria-hidden': 'true' }, i.done ? '✓' : '○'), h('span', { class: 'visually-hidden' }, i.done ? 'Fatto: ' : 'Da fare: '), i.text))),
  rating: ({ state }) => (state.value ? h('p', { class: 'mod-read-text' }, `${state.value} su 5`) : null),
  choice: ({ state }) => (state.value ? h('p', { class: 'mod-read-text' }, state.value) : null),
  premeditatio: ({ state }) => h('div', {}, state.cases.filter((c) => c.event.trim() || c.response.trim()).map((c) => h('div', { class: 'mod-case' }, readBlock('Se…', c.event), readBlock('allora io…', c.response)))),
  negvis: ({ state }) => h('div', {}, readBlock('Che cosa immagino di perdere', state.imagine), readBlock('Che cosa apprezzo di più, adesso', state.appreciate)),
  virtues: ({ state }) =>
    h(
      'div',
      {},
      readBlock('Esercitate', state.exercised.map(virtueName).join(', ')),
      readBlock('Da curare', state.missed.map(virtueName).join(', ')),
      readBlock('', state.note),
    ),
  control: ({ state }) => h('div', {}, readBlock('Il momento', state.episode), readBlock('Dipende da me', state.mine), readBlock('Non dipende (del tutto) da me', state.notmine)),
  mood: ({ state }) => readBlock('', [state.mood ? `Umore: ${MOOD_WORDS[state.mood - 1]}` : '', state.energy ? `Energia: ${ENERGY_WORDS[state.energy - 1]}` : ''].filter(Boolean).join(' · ')),
  evening({ state }) {
    const variant = EVENING_VARIANTS.find((v) => v.id === state.variant) ?? EVENING_VARIANTS[0];
    return h('div', {}, variant.questions.map((q, i) => readBlock(q, state.answers[i])));
  },
};

/**
 * Il corpo di un modulo. `def`: { type, name, options }; `data`: quello che c'è nel database (anche vuoto o storto);
 * `onChange(dati)`: chiamata ad ogni modifica. Con `readOnly` non si può cambiare nulla.
 */
export function buildBody({ def, data, onChange, readOnly = false }) {
  const state = normalizeData(def.type, data);
  const emit = () => onChange?.(copy(state));
  const draw = (readOnly ? READ : EDIT)[def.type];
  const node = draw ? draw({ def, state, emit }) : null;
  return node ?? h('div', {});
}
