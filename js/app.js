// Avvio dell'app: apre il database, applica l'aspetto, gestisce le schermate.

import { applyAppearance } from './appearance.js';
import { flushAll } from './autosave.js';
import { todayStr } from './dates.js';
import { openDb } from './db.js';
import { h } from './dom.js';
import { hideCover, showCover, showLockScreen } from './lockscreen.js';
import { shouldRelock } from './lockpolicy.js';
import { lockState, refreshLockState } from './lockstate.js';
import { initNavigation, setCurrentHash, settleScroll } from './navigation.js';
import { recordTiming, takeTap } from './perf.js';
import { activeTab, parseRoute } from './routes.js';
import { getSettings } from './settings.js';
import { initToolbar } from './toolbar.js';
import { toast } from './ui.js';
import { mountArchive } from './views/archive.js';
import { mountGoal } from './views/goal.js';
import { mountGoals } from './views/goals.js';
import { mountRead } from './views/read.js';
import { mountSettings } from './views/settings.js';
import { mountToday } from './views/today.js';

const view = document.getElementById('view');
let db = null;
let current = null; // { destroy }
let renderedToday = null; // giorno mostrato dalla pagina «Oggi», per accorgersi della mezzanotte
let renderToken = 0;
let locked = false; // la schermata di blocco è aperta: nessun contenuto del diario nella pagina
let hiddenAt = null; // quando l'app è andata in background

const SCREEN_NAME = { today: 'Oggi', day: 'Giorno', archive: 'Archivio', goals: 'Obiettivi', goal: 'Obiettivo', settings: 'Impostazioni' };

/**
 * Disegna la schermata dell'indirizzo corrente. `ahead` = { hash, state } per disegnare una schermata PRIMA che la
 * cronologia del browser sia arrivata lì (il «torna a Oggi» è lento: vedi navigation.js).
 */
async function render(ahead = null) {
  if (locked) {
    settleScroll();
    return;
  }
  const token = ++renderToken;
  const started = takeTap();
  const today = todayStr();
  const hash = ahead?.hash ?? location.hash;
  const route = parseRoute(hash, today);
  setCurrentHash(hash || '#/oggi');

  // la barra in basso risponde subito al tocco, prima di tutto il resto
  const active = activeTab(route, ahead?.state ?? history.state);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.getAttribute('href') === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  await flushAll();
  await current?.destroy();
  current = null;
  if (token !== renderToken || locked) return; // nel frattempo si è cambiata schermata o si è bloccata l'app

  view.classList.remove('view-in');
  try {
    renderedToday = route.name === 'today' ? today : null;
    if (route.name === 'settings') current = await mountSettings({ db, container: view });
    else if (route.name === 'archive') current = await mountArchive({ db, container: view, route });
    else if (route.name === 'goals') current = await mountGoals({ db, container: view, route });
    else if (route.name === 'goal') current = await mountGoal({ db, container: view, id: route.id });
    else if (route.mode === 'read') current = await mountRead({ db, container: view, date: route.date });
    else current = await mountToday({ db, container: view, date: route.date });
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('p', { class: 'fatal' }, 'Non riesco a mostrare questa pagina. Riprova a riaprire l’app.'));
  }
  if (token !== renderToken) return;
  if (locked) {
    view.replaceChildren(); // l'app si è bloccata mentre si disegnava: niente contenuto
    return;
  }
  settleScroll();
  void view.offsetWidth; // riavvia la breve dissolvenza
  view.classList.add('view-in');
  recordTiming(SCREEN_NAME[route.name] ?? 'Schermata', performance.now() - started);
}

// Toglie il diario dalla pagina e chiede di sbloccare; poi ridisegna la schermata corrente.
async function lockApp() {
  if (locked) return;
  locked = true;
  await flushAll();
  document.body.classList.remove('writing');
  document.activeElement?.blur?.();
  await current?.destroy();
  current = null;
  view.replaceChildren();
  await showLockScreen(await getSettings(db));
  locked = false;
  hiddenAt = null;
  document.documentElement.classList.remove('boot-lock');
  await render();
}

function showFatal(message) {
  document.documentElement.classList.remove('boot-lock');
  view.replaceChildren(h('section', { class: 'page' }, h('h1', { class: 'page-title' }, 'Qualcosa non va'), h('p', {}, message)));
}

async function start() {
  try {
    db = await openDb();
  } catch (err) {
    console.error(err);
    showFatal('Non riesco ad aprire l’archivio del diario. Se stai usando la navigazione privata, riapri l’app in una finestra normale.');
    return;
  }
  const settings = await getSettings(db);
  applyAppearance(settings);
  refreshLockState(settings);
  initToolbar();

  // Dati al sicuro quando si lascia l'app o si cambia scheda; con il blocco attivo si copre il contenuto.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAll();
      if (lockState.active && !locked) {
        hiddenAt = Date.now();
        showCover(); // nasconde subito il contenuto (anche nell'anteprima delle app recenti)
      }
    } else if (lockState.active && !locked && hiddenAt !== null) {
      if (shouldRelock({ lockEnabled: true, hiddenAt, now: Date.now() })) lockApp();
      else hideCover();
      hiddenAt = null;
    } else if (renderedToday && renderedToday !== todayStr()) {
      render(); // è passata la mezzanotte
    }
  });
  window.addEventListener('pagehide', () => flushAll());
  initNavigation({ render });

  if (lockState.active) await lockApp();
  else await render();

  navigator.storage?.persist?.().catch(() => {});
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offerUpdate = () => {
        if (!reg.waiting || !navigator.serviceWorker.controller) return;
        toast('È pronto un aggiornamento dell’app.', {
          actionLabel: 'Aggiorna',
          onAction: async () => {
            await flushAll();
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
            reg.waiting.postMessage('SKIP_WAITING');
          },
        });
      };
      offerUpdate();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') offerUpdate();
        });
      });
    })
    .catch((err) => console.warn('Service worker non registrato:', err));
}

start();
