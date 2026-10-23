// Schermata di blocco e «copertura» quando si esce dall'app.
//
// • Copertura: appena l'app va in background il contenuto viene nascosto (anche per l'anteprima delle app recenti).
// • Blocco: dopo più di un minuto fuori, serve l'impronta (se registrata) oppure il PIN.
//   Il PIN è la via di riserva: compare come alternativa se l'impronta non viene riconosciuta,
//   oppure è l'unica via se non c'è nessuna impronta registrata.

import { h } from './dom.js';
import { EMPTY_LOCKOUT, saveLockout } from './lockout.js';
import { createPinPad } from './pinpad.js';
import { currentWaitMs, tryPin, waitMessage } from './pincheck.js';
import { authenticateFingerprint, fingerprintAvailable } from './webauthn.js';

let cover = null;

export function showCover() {
  if (!cover) {
    cover = h('div', { class: 'cover', 'aria-hidden': 'true' }, h('p', { class: 'lock-brand' }, 'Diario Stoico'));
    document.body.append(cover);
  }
  cover.classList.add('is-on');
}

export function hideCover() {
  cover?.classList.remove('is-on');
}

const inertTargets = () => [document.getElementById('view'), document.querySelector('.tabbar'), document.querySelector('.toolbar')].filter(Boolean);

/** Mostra il blocco e si risolve quando l'utente ha sbloccato. */
export async function showLockScreen(settings) {
  hideCover();
  let useFingerprint = false;
  let pad = null;
  let countdown = null;
  let unlockResolve;
  const done = new Promise((resolve) => (unlockResolve = resolve));

  const panel = h('div', { class: 'lock-panel' });
  const root = h(
    'div',
    { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Diario Stoico bloccato' },
    h(
      'div',
      { class: 'lock-top' },
      h('img', { class: 'lock-art', src: 'icons/filosofo.png', alt: '', width: 720, height: 720, decoding: 'async' }),
      h('p', { class: 'lock-brand' }, 'Diario Stoico'),
    ),
    panel,
  );
  // la schermata compare subito; se c'è l'impronta si scopre un attimo dopo
  document.body.append(root);
  document.body.classList.add('lock-open');
  for (const el of inertTargets()) el.inert = true;
  useFingerprint = !!settings.webauthn && (await fingerprintAvailable());

  function unlock() {
    clearInterval(countdown);
    pad?.destroy();
    for (const el of inertTargets()) el.inert = false;
    document.body.classList.remove('lock-open');
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), 200);
    unlockResolve();
  }

  // ----- impronta -----
  function showFingerprint(note = '') {
    pad?.destroy();
    pad = null;
    clearInterval(countdown);
    const status = h('p', { class: 'pin-message', role: 'status', 'aria-live': 'polite' }, note);
    const button = h('button', { type: 'button', class: 'btn btn-primary btn-wide', onclick: attempt }, 'Sblocca con l’impronta');
    async function attempt() {
      button.disabled = true;
      status.textContent = '';
      const ok = await authenticateFingerprint(settings.webauthn);
      if (ok) return unlock();
      button.disabled = false;
      status.textContent = 'Impronta non riconosciuta. Riprova, oppure usa il PIN.';
      status.className = 'pin-message is-error';
    }
    panel.replaceChildren(
      status,
      button,
      h('button', { type: 'button', class: 'link-button', onclick: showPin }, 'Usa il PIN'),
    );
    return attempt;
  }

  // ----- PIN -----
  function showPin() {
    pad?.destroy();
    clearInterval(countdown);
    pad = createPinPad({ onSubmit: submit });
    panel.replaceChildren(
      ...[
        pad.element,
        useFingerprint ? h('button', { type: 'button', class: 'link-button', onclick: () => showFingerprint() }, 'Usa l’impronta') : null,
      ].filter(Boolean),
    );
    startWaitIfNeeded();
  }

  async function submit(pin) {
    const result = await tryPin(pin, settings.pinHash);
    if (result.ok) {
      saveLockout({ ...EMPTY_LOCKOUT });
      return unlock();
    }
    pad.reset();
    if (result.waitMs > 0) startWaitIfNeeded();
    else pad.setMessage('PIN non corretto.', 'error');
  }

  function startWaitIfNeeded() {
    clearInterval(countdown);
    const tick = () => {
      const ms = currentWaitMs();
      if (ms <= 0) {
        clearInterval(countdown);
        pad.setDisabled(false);
        pad.setMessage('');
        return;
      }
      pad.setDisabled(true);
      pad.setMessage(waitMessage(ms), 'error');
    };
    if (currentWaitMs() > 0) {
      tick();
      countdown = setInterval(tick, 1000);
    }
  }

  if (useFingerprint) {
    const attempt = showFingerprint();
    // si prova subito l'impronta: di solito è ciò che serve; se non parte, c'è il pulsante
    setTimeout(() => {
      if (document.body.contains(root) && document.visibilityState === 'visible') attempt();
    }, 350);
  } else {
    showPin();
  }
  return done;
}
