// Script classico caricato nell'<head>: applica tema, carattere e dimensione PRIMA del primo disegno
// della pagina, così non c'è il lampo "crema" prima del tema scuro. Vedi appearance.js.
(function () {
  try {
    var a = JSON.parse(localStorage.getItem('ds-appearance') || 'null');
    if (!a) return;
    var root = document.documentElement;
    var theme = a.theme === 'scuro' ? 'scuro' : 'carta';
    if (a.theme === 'sistema') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'carta';
    root.dataset.theme = theme;
    if (a.font === 'sans' || a.font === 'serif') root.dataset.font = a.font;
    if (['s', 'm', 'l', 'xl'].indexOf(a.fontSize) !== -1) root.dataset.size = a.fontSize;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'scuro' ? '#000000' : '#F6F1E7');
  } catch (e) {
    /* nessun problema: restano i valori predefiniti */
  }
})();
