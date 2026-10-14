// Script classico caricato nell'<head>: applica tema, carattere, dimensione e interlinea PRIMA del primo disegno
// della pagina, così non c'è il lampo "crema" prima del tema scuro. Vedi appearance.js.
// Se il blocco è attivo nasconde subito il contenuto, finché non compare la schermata di blocco.
(function () {
  try {
    var root = document.documentElement;
    if (localStorage.getItem('ds-lock-hint')) root.classList.add('boot-lock');
    var a = JSON.parse(localStorage.getItem('ds-appearance') || 'null');
    if (!a) return;
    var theme = a.theme === 'scuro' ? 'scuro' : 'carta';
    if (a.theme === 'sistema') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'carta';
    root.dataset.theme = theme;
    if (a.font === 'sans' || a.font === 'serif') root.dataset.font = a.font;
    if (['s', 'm', 'l', 'xl'].indexOf(a.fontSize) !== -1) root.dataset.size = a.fontSize;
    if (['s', 'm', 'l', 'xl'].indexOf(a.lineSpacing) !== -1) root.dataset.spacing = a.lineSpacing;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'scuro' ? '#000000' : '#F6F1E7');
  } catch (e) {
    /* nessun problema: restano i valori predefiniti */
  }
})();
