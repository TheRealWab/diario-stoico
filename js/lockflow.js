// Procedure del blocco nelle Impostazioni: attivare, cambiare PIN, impronta sì/no, disattivare.
// Operazioni delicate (cambiare PIN, togliere il blocco…) chiedono prima di dimostrare chi sei.

import { daysAgoLabel, todayStr } from './dates.js';
import { h } from './dom.js';
import { createPinPad } from './pinpad.js';
import { tryPin, waitMessage } from './pincheck.js';
import { PIN_MAX, PIN_MIN, createPinRecord } from './pin.js';
import { getSettings, saveSettings } from './settings.js';
import { refreshLockState } from './lockstate.js';
import { confirmDialog, messageDialog, showDialog, toast } from './ui.js';
import { authenticateFingerprint, fingerprintAvailable, registerFingerprint } from './webauthn.js';

/**
 * Finestra con il tastierino. `verify(pin)` può restituire { ok, message }: se ok è falso il PIN
 * non viene accettato. Si risolve con il PIN digitato, oppure null se si annulla.
 */
function pinDialog({ title, text, verify = null }) {
  return new Promise((resolve) => {
    let pad;
    let accepted = null; // il PIN accettato (non si scrive mai nella pagina)
    const dlg = h(
      'dialog',
      { class: 'dialog dialog-pin', 'aria-label': title },
      h('h2', { class: 'dialog-title' }, title),
      text ? h('p', { class: 'dialog-text' }, text) : null,
      h('div', { class: 'dialog-pad' }),
      h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close('') }, 'Annulla')),
    );
    pad = createPinPad({
      onSubmit: async (pin) => {
        if (verify) {
          const result = await verify(pin);
          if (!result.ok) {
            pad.reset();
            pad.setMessage(result.message, 'error');
            return;
          }
        }
        accepted = pin;
        dlg.close('ok');
      },
    });
    dlg.querySelector('.dialog-pad').append(pad.element);
    dlg.addEventListener('close', () => {
      pad.destroy();
      resolve(dlg.returnValue === 'ok' ? accepted : null);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Dimostra di essere il proprietario: impronta se c'è, altrimenti (o se non riesce) PIN. */
export async function requireAuth(settings, { reason }) {
  if (settings.webauthn && (await fingerprintAvailable())) {
    if (await authenticateFingerprint(settings.webauthn)) return true;
  }
  const pin = await pinDialog({
    title: 'Inserisci il PIN',
    text: reason,
    verify: async (value) => {
      const r = await tryPin(value, settings.pinHash);
      if (r.ok) return { ok: true };
      return { ok: false, message: r.waitMs > 0 ? waitMessage(r.waitMs) : 'PIN non corretto.' };
    },
  });
  return pin !== null;
}

/** Chiede un PIN nuovo due volte. Restituisce il record da salvare, oppure null se si annulla. */
async function chooseNewPin() {
  for (;;) {
    const first = await pinDialog({ title: 'Scegli un PIN', text: `Da ${PIN_MIN} a ${PIN_MAX} cifre. Serve se l’impronta non viene riconosciuta o non è attiva.` });
    if (first === null) return null;
    const second = await pinDialog({ title: 'Ripeti il PIN' });
    if (second === null) return null;
    if (first === second) return createPinRecord(first);
    await messageDialog({ title: 'I PIN non coincidono', text: 'Riprova: i due PIN devono essere uguali.' });
  }
}

/** Registra l'impronta e la prova subito. Restituisce { id, publicKey, alg } o null. */
async function setUpFingerprint() {
  try {
    const credential = await registerFingerprint();
    if (!(await authenticateFingerprint(credential))) throw new Error('verifica non riuscita');
    return credential;
  } catch (err) {
    console.warn('Impronta non attivata:', err);
    await messageDialog({
      title: 'Impronta non attivata',
      text: 'Non sono riuscito a registrare o verificare l’impronta. Il blocco userà solo il PIN; potrai riprovare dalle Impostazioni.',
    });
    return null;
  }
}

export async function enableLock({ db, doExport }) {
  const settings = await getSettings(db);
  const choice = await showDialog({
    title: 'Prima di attivare il blocco',
    body: [
      h('p', {}, 'Se dimentichi il PIN, nessuno potrà recuperarlo: l’unico modo di rientrare è cancellare i dati dell’app da Chrome e ripristinare un backup.'),
      h('p', {}, `Ultimo backup: ${daysAgoLabel(settings.lastBackupDate, todayStr())}.`),
    ],
    actions: [
      { label: 'Fai il backup ora e continua', value: 'backup', kind: 'primary' },
      { label: 'Continua senza', value: 'go', kind: 'secondary' },
      { label: 'Annulla', value: 'cancel', kind: 'ghost' },
    ],
  });
  if (choice !== 'backup' && choice !== 'go') return false;
  if (choice === 'backup') await doExport();

  const pinHash = await chooseNewPin();
  if (!pinHash) return false;

  let webauthn = null;
  if (await fingerprintAvailable()) {
    const useIt = await confirmDialog({
      title: 'Usare l’impronta?',
      text: 'Con l’impronta apri il diario più in fretta. Il PIN resta come alternativa se l’impronta non viene riconosciuta.',
      confirmLabel: 'Sì, usa l’impronta',
      cancelLabel: 'Solo PIN',
    });
    if (useIt) webauthn = await setUpFingerprint();
  }

  const saved = await saveSettings(db, { lockEnabled: true, pinHash, webauthn });
  refreshLockState(saved);
  toast(webauthn ? 'Blocco attivato: impronta e PIN.' : 'Blocco attivato con il PIN.');
  return true;
}

export async function changePin({ db }) {
  const settings = await getSettings(db);
  if (!(await requireAuth(settings, { reason: 'Per cambiare il PIN conferma che sei tu.' }))) return false;
  const pinHash = await chooseNewPin();
  if (!pinHash) return false;
  refreshLockState(await saveSettings(db, { pinHash }));
  toast('PIN cambiato.');
  return true;
}

export async function toggleFingerprint({ db }) {
  const settings = await getSettings(db);
  if (!(await requireAuth(settings, { reason: 'Conferma che sei tu per cambiare l’impronta.' }))) return false;
  if (settings.webauthn) {
    refreshLockState(await saveSettings(db, { webauthn: null }));
    toast('Impronta disattivata: userai il PIN.');
    return true;
  }
  const webauthn = await setUpFingerprint();
  if (!webauthn) return false;
  refreshLockState(await saveSettings(db, { webauthn }));
  toast('Impronta attivata.');
  return true;
}

export async function disableLock({ db }) {
  const settings = await getSettings(db);
  if (!(await requireAuth(settings, { reason: 'Per disattivare il blocco conferma che sei tu.' }))) return false;
  const ok = await confirmDialog({
    title: 'Disattivare il blocco?',
    text: 'Il diario si aprirà senza impronta né PIN.',
    confirmLabel: 'Disattiva',
    danger: true,
  });
  if (!ok) return false;
  refreshLockState(await saveSettings(db, { lockEnabled: false, pinHash: null, webauthn: null }));
  toast('Blocco disattivato.');
  return true;
}
