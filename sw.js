// Service worker: mette in cache tutti i file dell'app per farla funzionare senza connessione.
//
// Aggiornamenti: la versione nuova si scarica in silenzio e resta "in attesa". L'app mostra
// "Aggiorna" e solo allora (dopo aver salvato il testo) la attiva. I dati del diario stanno in
// IndexedDB e questo file non li tocca mai.

// <precache> (generato da tools/update-sw.mjs: non modificare a mano)
const CACHE_VERSION = '656da356e1d6';
const PRECACHE = [
  "css/app.css",
  "css/theme.css",
  "fonts/inter-latin-wght-normal.woff2",
  "fonts/lora-latin-wght-italic.woff2",
  "fonts/lora-latin-wght-normal.woff2",
  "icons/apple-touch-icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/app.js",
  "js/appearance.js",
  "js/archive.js",
  "js/autosave.js",
  "js/b64.js",
  "js/backup.js",
  "js/boot.js",
  "js/calendar.js",
  "js/crypto-backup.js",
  "js/dates.js",
  "js/db.js",
  "js/dom.js",
  "js/editor.js",
  "js/entries.js",
  "js/file-backup.js",
  "js/goaldialogs.js",
  "js/goals-policy.js",
  "js/goals.js",
  "js/lockflow.js",
  "js/lockout.js",
  "js/lockpolicy.js",
  "js/lockscreen.js",
  "js/lockstate.js",
  "js/markdown.js",
  "js/migrations.js",
  "js/moduledialogs.js",
  "js/modules-catalog.js",
  "js/modules.js",
  "js/navigation.js",
  "js/passworddialog.js",
  "js/periods.js",
  "js/pin.js",
  "js/pincheck.js",
  "js/pinpad.js",
  "js/quotes.js",
  "js/routes.js",
  "js/search.js",
  "js/settings.js",
  "js/toolbar.js",
  "js/ui.js",
  "js/util.js",
  "js/views/archive.js",
  "js/views/dayhead.js",
  "js/views/daymodules.js",
  "js/views/goal.js",
  "js/views/goalrow.js",
  "js/views/goals.js",
  "js/views/modulebody.js",
  "js/views/modulecard.js",
  "js/views/read.js",
  "js/views/settings.js",
  "js/views/strip.js",
  "js/views/today.js",
  "js/webauthn-verify.js",
  "js/webauthn.js",
  "manifest.webmanifest"
];
// </precache>

const CACHE_PREFIX = 'diario-stoico-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' = scarica davvero dal server, mai da una copia vecchia del browser
      cache.addAll(['./', ...PRECACHE].map((p) => new Request(scopeUrl(p), { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      // aperture dell'app (anche con parametri): sempre la pagina principale
      if (req.mode === 'navigate') {
        const shell = await cache.match(scopeUrl('index.html'));
        if (shell) return shell;
      }
      return fetch(req);
    }),
  );
});
