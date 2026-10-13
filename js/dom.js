// Costruzione sicura della pagina. Il testo passa SEMPRE come nodo di testo:
// qui non esiste (e non deve esistere) nessun innerHTML con contenuto dell'utente.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * h('button', { class: 'x', onclick: fn, 'aria-label': 'Ciao' }, 'testo', altroNodo)
 * Le proprietà "on…" diventano listener; false/null/undefined vengono ignorate.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

const ICONS = {
  'chevron-left': [['path', { d: 'M15 18l-6-6 6-6' }]],
  'chevron-right': [['path', { d: 'M9 6l6 6-6 6' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  trash: [['path', { d: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' }]],
};

/** Icona SVG a tratto (decorativa: va sempre accompagnata da un'etichetta testuale). */
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of ICONS[name]) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}
