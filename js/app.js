// Avvio dell'app: apre il database, applica l'aspetto, gestisce le schermate.

import { applyAppearance } from './appearance.js';
import { flushAll } from './autosave.js';
import { todayStr } from './dates.js';
import { openDb } from './db.js';
import { h } from './dom.js';
import { initNavigation, setCurrentHash, settleScroll } from './navigation.js';
import { parseRoute, tabHashOf } from './routes.js';
import { getSettings } from './settings.js';
import { initToolbar } from './toolbar.js';
import { toast } from './ui.js';
import { mountArchive } from './views/archive.js';
import { mountRead } from './views/read.js';
import { mountSettings } from './views/settings.js';
import { mountToday } from './views/today.js';

const view = document.getElementById('view');
let db = null;
let current = null; // { destroy }
let renderedToday = null; // giorno mostrato dalla pagina «Oggi», per accorgersi della mezzanotte
let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const today = todayStr();
  const route = parseRoute(location.hash, today);
  setCurrentHash(location.hash || '#/oggi');

  await flushAll();
  await current?.destroy();
  current = null;
  if (token !== renderToken) return; // nel frattempo si è cambiata di nuovo schermata

  // un giorno aperto dall'archivio lascia acceso «Archivio»
  const fromArchive = history.state?.depth >= 3 && history.state?.parent === 'archive';
  const activeTab = fromArchive ? '#/archivio' : tabHashOf(route);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.getAttribute('href') === activeTab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  view.classList.remove('view-in');
  try {
    renderedToday = route.name === 'today' ? today : null;
    if (route.name === 'settings') current = await mountSettings({ db, container: view });
    else if (route.name === 'archive') current = await mountArchive({ db, container: view, route });
    else if (route.mode === 'read') current = await mountRead({ db, container: view, date: route.date });
    else current = await mountToday({ db, container: view, date: route.date });
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('p', { class: 'fatal' }, 'Non riesco a mostrare questa pagina. Riprova a riaprire l’app.'));
  }
  if (token !== renderToken) return;
  settleScroll();
  void view.offsetWidth; // riavvia la breve dissolvenza
  view.classList.add('view-in');
}
function showFatal(message) {
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
  applyAppearance(await getSettings(db));
  initToolbar();

  // Dati al sicuro quando si lascia l'app o si cambia scheda.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
    else if (renderedToday && renderedToday !== todayStr()) render(); // è passata la mezzanotte
  });
  window.addEventListener('pagehide', () => flushAll());
  initNavigation({ render });

  await render();

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
