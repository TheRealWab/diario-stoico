// Tema, carattere e dimensione: si applicano come attributi su <html>;
// tutto il resto lo fanno le variabili CSS (css/theme.css).

export const APPEARANCE_KEY = 'ds-appearance';
const THEME_COLORS = { carta: '#F6F1E7', scuro: '#000000' };

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
let current = null;

export function resolveTheme(theme) {
  if (theme === 'sistema') return darkQuery?.matches ? 'scuro' : 'carta';
  return theme === 'scuro' ? 'scuro' : 'carta';
}

export function applyAppearance(settings) {
  current = { theme: settings.theme, font: settings.font, fontSize: settings.fontSize };
  const root = document.documentElement;
  const theme = resolveTheme(current.theme);
  root.dataset.theme = theme;
  root.dataset.font = current.font;
  root.dataset.size = current.fontSize;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  try {
    // copia per boot.js, che la legge subito all'avvio per evitare lampi del tema sbagliato
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    /* il salvataggio vero è in IndexedDB: questa è solo una comodità */
  }
}

// Con "segui il sistema", cambiare il tema del telefono si riflette subito.
darkQuery?.addEventListener('change', () => {
  if (current?.theme === 'sistema') applyAppearance(current);
});
