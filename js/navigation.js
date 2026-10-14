// Navigazione e tasto «indietro» di Android.
//
// La cronologia del browser è organizzata a «profondità»:
//
//   0  base            voce di guardia: arrivarci con «indietro» = si sta per uscire
//   1  Oggi / giorno   (le frecce dei giorni SOSTITUISCONO la voce, non ne aggiungono)
//   2  Archivio o Impostazioni (passare dall'una all'altra sostituisce)
//   3+ un giorno aperto dall'archivio, ecc. (si aggiunge: «indietro» torna all'archivio)
//
// • «indietro» da una schermata torna a quella sotto.
// • Da Oggi, «indietro» arriva alla base: l'app mostra «Premi ancora indietro per uscire» e, se non
//   succede nulla, si riarma da sola. (Una PWA non può chiudersi da codice, quindi l'uscita vera è
//   un secondo «indietro» dell'utente.)
// • La barra in basso porta direttamente al livello giusto.
//
// Chrome ignora le voci create prima che l'utente tocchi la pagina (per evitare le «trappole»):
// per questo la voce di base si crea al primo tocco.

import { flushAll } from './autosave.js';
import { todayStr } from './dates.js';
import { familyOf, isTabRoute, parseRoute } from './routes.js';
import { hideToast, toast } from './ui.js';

let renderFn = () => {};
let armed = false;
let currentHash = '#/oggi';
let pendingGo = null; // schermata da aprire dopo un history.go()
let backNav = false; // la schermata che si sta disegnando è stata raggiunta con «indietro»
let savingScroll = true;
let exitTimer = null;
let keyCounter = 0;
const scrollByKey = new Map();

const newKey = () => `${Date.now().toString(36)}-${++keyCounter}`;
const hashNow = () => location.hash || '#/oggi';
const routeOf = (hash) => parseRoute(hash, todayStr());
const depthOfRoute = (hash) => (isTabRoute(routeOf(hash)) ? 2 : 1);
const depthNow = () => history.state?.depth ?? depthOfRoute(hashNow());
// noHome: l'app è stata aperta direttamente su Archivio/Impostazioni, quindi sotto non c'è una voce «Oggi»
const state = (depth, parent, noHome = false) => ({ ds: 'app', depth, key: newKey(), parent: parent ?? null, noHome });

/** Da chiamare dopo ogni disegno di pagina. */
export function setCurrentHash(hash) {
  currentHash = hash;
}

/** Vero mentre si disegna una schermata raggiunta con «indietro» (si ripristina ciò che c'era). */
export const isBackNavigation = () => backNav;

/** Da chiamare a disegno finito: rimette la pagina allo scorrimento giusto. */
export function settleScroll() {
  const y = backNav ? scrollByKey.get(history.state?.key) ?? 0 : 0;
  window.scrollTo(0, y);
  backNav = false;
  savingScroll = true;
}

function rememberScroll() {
  const key = history.state?.key;
  if (key) scrollByKey.set(key, window.scrollY);
  savingScroll = false;
}

function arm() {
  if (armed) return;
  armed = true;
  const here = hashNow();
  if (history.state?.ds !== 'base') history.replaceState({ ds: 'base', depth: 0, key: newKey() }, '', '#/oggi');
  const depth = depthOfRoute(here);
  history.pushState(state(depth, null, depth === 2), '', here);
}

function replace(hash) {
  history.replaceState(state(depthNow(), history.state?.parent, !!history.state?.noHome), '', hash);
}

function push(hash) {
  const depth = depthNow();
  const parent = depth === 1 ? 'home' : depth === 2 ? familyOf(routeOf(hashNow())) : history.state?.parent;
  history.pushState(state(depth + 1, parent, !!history.state?.noHome), '', hash);
}

/**
 * Apre una schermata.
 *   via 'push'     (predefinito) si aggiunge alla cronologia: «indietro» torna qui
 *   via 'replace'  sostituisce la schermata corrente (frecce dei giorni, sezioni dell'archivio…)
 *   via 'tab'      voce della barra in basso: porta al livello giusto
 */
export function go(hash, via = 'push') {
  if (history.state?.ds === 'base') stay(); // era comparso «premi ancora indietro»
  if (hash === hashNow()) return;
  const target = routeOf(hash);
  const depth = depthNow();
  rememberScroll();

  if (via === 'tab') {
    if (!isTabRoute(target)) {
      // «Oggi»: si torna al livello 1
      if (depth > 1 && history.state?.noHome) {
        history.replaceState(state(1), '', hash); // sotto non c'è una voce «Oggi» a cui tornare
      } else if (depth > 1) {
        pendingGo = hash;
        history.go(1 - depth);
        return;
      }
      replace(hash);
    } else if (depth === 1) {
      push(hash);
    } else if (depth === 2) {
      replace(hash);
    } else {
      // da un giorno aperto dall'archivio: si torna al livello 2 (e, se serve, si cambia scheda)
      if (history.state?.parent !== familyOf(target)) pendingGo = hash;
      history.go(2 - depth);
      return;
    }
  } else if (via === 'replace') {
    replace(hash);
  } else {
    push(hash);
  }
  renderFn();
}

/** Torna alla schermata precedente se c'è; altrimenti va a `hash` (per esempio dopo aver eliminato ciò che si guardava). */
export function goBackOr(hash) {
  if (armed && (history.state?.depth ?? 1) > 1) history.back();
  else go(hash, 'replace');
}

// ---------- uscita ----------

function stay() {
  clearTimeout(exitTimer);
  hideToast();
  history.pushState(state(1), '', currentHash);
}

function onBackAtBase() {
  if (document.body.classList.contains('writing')) {
    // tastiera chiusa col tasto indietro ma cursore ancora nel testo: si esce dal testo, non dall'app
    document.activeElement?.blur();
    history.pushState(state(1), '', currentHash);
    return;
  }
  flushAll();
  toast('Premi ancora indietro per uscire.', { actionLabel: 'Resta', onAction: stay, sticky: true });
  clearTimeout(exitTimer);
  exitTimer = setTimeout(stay, 5000);
}

export function initNavigation({ render }) {
  renderFn = render;
  armed = history.state?.ds === 'app';
  history.scrollRestoration = 'manual';

  for (const type of ['pointerup', 'touchend', 'keydown']) {
    document.addEventListener(type, arm, { capture: true, passive: true });
  }

  window.addEventListener(
    'scroll',
    () => {
      const key = history.state?.key;
      if (key && savingScroll) scrollByKey.set(key, window.scrollY);
    },
    { passive: true },
  );

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    const via = a.dataset.tab !== undefined ? 'tab' : a.dataset.nav === 'replace' ? 'replace' : 'push';
    go(a.getAttribute('href'), via);
  });

  window.addEventListener('popstate', () => {
    if (history.state?.ds === 'base') {
      onBackAtBase();
      return;
    }
    savingScroll = false;
    backNav = !pendingGo;
    if (pendingGo) {
      const target = pendingGo;
      pendingGo = null;
      if (hashNow() !== target) replace(target);
    }
    renderFn();
  });
}
