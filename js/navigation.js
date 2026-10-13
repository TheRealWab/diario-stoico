// Navigazione e tasto «indietro» di Android.
//
// La cronologia del browser è organizzata così:
//
//   [ base ]  →  [ Oggi / un giorno ]  →  [ Impostazioni ]
//
// • Da Impostazioni, «indietro» riporta a Oggi.
// • Da Oggi, «indietro» arriva alla voce «base»: lì, invece di uscire di colpo, l'app chiede conferma.
// • Le frecce dei giorni sostituiscono la voce corrente, così «indietro» non ripercorre tutti i giorni visti.
//
// Chrome ignora le voci di cronologia create senza che l'utente abbia toccato la pagina
// (per evitare le «trappole» dei siti). Per questo la voce «base» si crea al primo tocco.

import { flushAll } from './autosave.js';
import { parseRoute } from './routes.js';
import { confirmDialog, toast } from './ui.js';

let renderFn = () => {};
let armed = false;
let currentHash = '#/oggi';

const hashNow = () => location.hash || '#/oggi';
const stateFor = (hash) => ({ ds: parseRoute(hash).name === 'settings' ? 'settings' : 'root' });

/** Da chiamare dopo ogni disegno di pagina. */
export function setCurrentHash(hash) {
  currentHash = hash;
}

function arm() {
  if (armed) return;
  armed = true;
  const here = hashNow();
  if (history.state?.ds !== 'base') history.replaceState({ ds: 'base' }, '', '#/oggi');
  history.pushState(stateFor(here), '', here);
}

/** Va a un'altra schermata (es. '#/impostazioni', '#/oggi', '#/giorno/2026-10-12'). */
export function go(hash) {
  const target = parseRoute(hash);
  const here = parseRoute(hashNow());
  if (hashNow() === hash || (hash === '#/oggi' && here.name === 'today')) return;
  if (target.name === 'settings') {
    history.pushState({ ds: 'settings' }, '', hash);
  } else if (here.name === 'settings' && target.name === 'today' && history.state?.ds === 'settings') {
    history.back(); // il disegno parte da popstate
    return;
  } else {
    history.replaceState({ ds: 'root' }, '', hash);
  }
  renderFn();
}

function repush() {
  history.pushState(stateFor(currentHash), '', currentHash);
}

async function onBackAtBase() {
  if (document.body.classList.contains('writing')) {
    // tastiera chiusa col tasto indietro ma cursore ancora nel testo: si esce dal testo, non dall'app
    document.activeElement?.blur();
    repush();
    return;
  }
  await flushAll();
  const leave = await confirmDialog({
    title: 'Uscire dall’app?',
    text: 'Il diario è salvato. Potrai riaprirlo quando vuoi.',
    confirmLabel: 'Esci',
    cancelLabel: 'Resta',
  });
  if (!leave) {
    repush();
    return;
  }
  // Si tenta di chiudere la finestra; se Android non lo permette, un altro «indietro» esce davvero
  // (siamo sulla prima voce della cronologia).
  armed = false;
  window.close();
  setTimeout(() => toast('Premi ancora «indietro» per uscire.'), 400);
}

export function initNavigation({ render }) {
  renderFn = render;
  armed = history.state?.ds === 'root' || history.state?.ds === 'settings';

  for (const type of ['pointerup', 'touchend', 'keydown']) {
    document.addEventListener(type, arm, { capture: true, passive: true });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });

  window.addEventListener('popstate', () => {
    if (history.state?.ds === 'base') onBackAtBase();
    else renderFn();
  });
}
