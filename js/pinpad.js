// Tastierino numerico per il PIN: grande, da usare con una mano, senza tastiera del telefono.

import { h, icon } from './dom.js';
import { PIN_MAX, PIN_MIN } from './pin.js';

/**
 * onSubmit(pin) viene chiamata con il PIN digitato (può essere asincrona).
 * Restituisce { element, reset(), setMessage(testo, tipo), setDisabled(bool), destroy() }.
 */
export function createPinPad({ onSubmit, submitLabel = 'OK' }) {
  let value = '';
  let disabled = false;
  let busy = false;

  const dots = h('div', { class: 'pin-dots', role: 'img' });
  const message = h('p', { class: 'pin-message', role: 'status', 'aria-live': 'polite' });
  const okKey = h('button', { type: 'button', class: 'pin-key pin-key-ok', onclick: submit }, submitLabel);
  const backKey = h('button', { type: 'button', class: 'pin-key pin-key-back', 'aria-label': 'Cancella una cifra', onclick: back }, icon('backspace'));
  const digit = (d) => h('button', { type: 'button', class: 'pin-key', onclick: () => add(d) }, d);
  const keys = h('div', { class: 'pin-keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit), backKey, digit('0'), okKey);
  const element = h('div', { class: 'pinpad', tabindex: '-1' }, dots, message, keys);

  function render() {
    const shown = Math.max(value.length, PIN_MIN);
    dots.replaceChildren(...Array.from({ length: shown }, (_, i) => h('span', { class: `pin-dot${i < value.length ? ' is-filled' : ''}` })));
    dots.setAttribute('aria-label', `PIN: ${value.length} ${value.length === 1 ? 'cifra' : 'cifre'}`);
    for (const k of keys.querySelectorAll('button')) k.disabled = disabled || busy;
    okKey.disabled = disabled || busy || value.length < PIN_MIN;
    backKey.disabled = disabled || busy || value.length === 0;
  }

  function add(d) {
    if (disabled || busy || value.length >= PIN_MAX) return;
    value += d;
    setMessage('');
    render();
  }

  function back() {
    if (disabled || busy) return;
    value = value.slice(0, -1);
    render();
  }

  async function submit() {
    if (disabled || busy || value.length < PIN_MIN) return;
    busy = true;
    render();
    const pin = value;
    try {
      await onSubmit(pin);
    } finally {
      busy = false;
      render();
    }
  }

  function setMessage(text, kind = '') {
    message.textContent = text;
    message.className = `pin-message${kind ? ` is-${kind}` : ''}`;
  }

  // anche con la tastiera fisica (utile sul computer)
  const onKey = (e) => {
    const handled = /^\d$/.test(e.key) || e.key === 'Backspace' || e.key === 'Enter';
    if (!handled || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); // altrimenti Invio "preme" anche il pulsante che ha il focus
    if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') submit();
    else add(e.key);
  };
  document.addEventListener('keydown', onKey);

  render();
  return {
    element,
    reset() {
      value = '';
      render();
    },
    setMessage,
    setDisabled(v) {
      disabled = v;
      render();
    },
    destroy() {
      document.removeEventListener('keydown', onKey);
    },
  };
}
