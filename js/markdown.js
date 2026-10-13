// Testo formattato del diario: un piccolo sottoinsieme di Markdown.
//
//   **grassetto**   *corsivo*   ## titoletto   - elenco puntato   1. elenco numerato
//   paragrafi separati da una riga vuota; \ protegge i caratteri speciali (\* \\ \- \# 1\.)
//
// Modello in memoria:
//   blocchi: { type: 'p' | 'h', runs } | { type: 'ul' | 'ol', items: [runs] }
//   runs:    [{ text, bold, italic }]
//
// Questo file non usa mai il DOM globale e non produce mai HTML come stringa:
// il testo dell'utente arriva alla pagina solo come nodi di testo.

const ESCAPABLE = new Set(['\\', '*', '-', '#', '.']);

// ---------- runs ----------

const fmtKey = (r) => `${r.bold ? 1 : 0}${r.italic ? 1 : 0}`;

/**
 * Forma canonica: niente runs vuoti, spazi ai bordi del grassetto/corsivo spostati fuori
 * (altrimenti il Markdown esportato non sarebbe valido), runs adiacenti uguali uniti.
 */
export function normalizeRuns(runs) {
  const spread = [];
  for (const r of runs) {
    if (!r.text) continue;
    const bold = !!r.bold;
    const italic = !!r.italic;
    if (!bold && !italic) {
      spread.push({ text: r.text, bold: false, italic: false });
      continue;
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.text);
    if (m[1]) spread.push({ text: m[1], bold: false, italic: false });
    if (m[2]) spread.push({ text: m[2], bold, italic });
    if (m[3]) spread.push({ text: m[3], bold: false, italic: false });
  }
  const out = [];
  for (const r of spread) {
    const last = out[out.length - 1];
    if (last && fmtKey(last) === fmtKey(r)) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

function trimRuns(runs) {
  const out = runs.map((r) => ({ ...r }));
  while (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '');
    if (out[0].text) break;
    out.shift();
  }
  while (out.length) {
    const last = out[out.length - 1];
    last.text = last.text.replace(/\s+$/, '');
    if (last.text) break;
    out.pop();
  }
  return normalizeRuns(out);
}

// ---------- testo -> runs ----------

export function parseInline(src) {
  const runs = [];
  let bold = false;
  let italic = false;
  let buf = '';
  const flush = () => {
    if (buf) runs.push({ text: buf, bold, italic });
    buf = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      buf += src[i + 1];
      i++;
    } else if (c === '*') {
      flush();
      if (src[i + 1] === '*') {
        bold = !bold;
        i++;
      } else {
        italic = !italic;
      }
    } else {
      buf += c;
    }
  }
  flush();
  return normalizeRuns(runs);
}

const escapeText = (t) => t.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');

// Grassetto e corsivo sono due interruttori indipendenti: ad ogni cambio di formato si
// scrive solo ciò che cambia (prima chiusure, poi aperture). In questo modo ogni
// sequenza di asterischi si legge in un solo modo, anche quando i formati si sovrappongono.
export function serializeInline(runs) {
  const MARK = { b: '**', i: '*' };
  const open = []; // marcatori aperti, nell'ordine di apertura
  let out = '';
  const toggle = (want) => {
    for (const m of [...open].reverse()) {
      if (!want[m]) {
        out += MARK[m];
        open.splice(open.indexOf(m), 1);
      }
    }
    for (const m of ['b', 'i']) {
      if (want[m] && !open.includes(m)) {
        out += MARK[m];
        open.push(m);
      }
    }
  };
  for (const r of normalizeRuns(runs)) {
    toggle({ b: r.bold, i: r.italic });
    out += escapeText(r.text);
  }
  toggle({ b: false, i: false });
  return out;
}

// ---------- Markdown <-> blocchi ----------

export function parse(md) {
  const blocks = [];
  let list = null;
  for (const raw of String(md ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    let m;
    if ((m = /^#{1,6}\s+(.+)$/.exec(line))) {
      list = null;
      blocks.push({ type: 'h', runs: parseInline(m[1]) });
    } else if ((m = /^-\s+(.*)$/.exec(line))) {
      if (!list || list.type !== 'ul') blocks.push((list = { type: 'ul', items: [] }));
      list.items.push(parseInline(m[1]));
    } else if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      if (!list || list.type !== 'ol') blocks.push((list = { type: 'ol', items: [] }));
      list.items.push(parseInline(m[1]));
    } else {
      list = null;
      blocks.push({ type: 'p', runs: parseInline(line) });
    }
  }
  return blocks;
}

export function serialize(blocks) {
  const parts = [];
  for (const b of blocks) {
    if (b.type === 'h') {
      parts.push(`## ${serializeInline(b.runs)}`);
    } else if (b.type === 'ul') {
      parts.push(b.items.map((it) => `- ${serializeInline(it)}`).join('\n'));
    } else if (b.type === 'ol') {
      parts.push(b.items.map((it, i) => `${i + 1}. ${serializeInline(it)}`).join('\n'));
    } else {
      let s = serializeInline(b.runs);
      // Un paragrafo che comincia come un elenco o un titolo va protetto.
      if (/^#{1,6}\s/.test(s) || /^-\s/.test(s)) s = `\\${s}`;
      else s = s.replace(/^(\d+)\.\s/, '$1\\. ');
      parts.push(s);
    }
  }
  return parts.join('\n\n');
}

/** Testo semplice, senza simboli: per anteprime e ricerca. */
export function toPlainText(md) {
  const lines = [];
  for (const b of parse(md)) {
    if (b.type === 'ul' || b.type === 'ol') {
      for (const it of b.items) lines.push(it.map((r) => r.text).join(''));
    } else {
      lines.push(b.runs.map((r) => r.text).join(''));
    }
  }
  return lines.join('\n');
}

// ---------- blocchi -> DOM ----------

/** Costruisce i nodi dell'editor/della lettura. `doc` è il document del browser. */
export function toDom(blocks, doc) {
  const frag = doc.createDocumentFragment();
  const addRuns = (parent, runs) => {
    for (const r of runs) {
      let node = doc.createTextNode(r.text);
      if (r.italic) {
        const em = doc.createElement('em');
        em.append(node);
        node = em;
      }
      if (r.bold) {
        const strong = doc.createElement('strong');
        strong.append(node);
        node = strong;
      }
      parent.append(node);
    }
  };
  for (const b of blocks) {
    if (b.type === 'ul' || b.type === 'ol') {
      const list = doc.createElement(b.type);
      for (const it of b.items) {
        const li = doc.createElement('li');
        addRuns(li, it);
        list.append(li);
      }
      frag.append(list);
    } else {
      const el = doc.createElement(b.type === 'h' ? 'h2' : 'p');
      addRuns(el, b.runs);
      frag.append(el);
    }
  }
  if (!blocks.length) {
    const p = doc.createElement('p');
    p.append(doc.createElement('br'));
    frag.append(p);
  }
  return frag;
}

// ---------- DOM -> blocchi ----------
// Legge ciò che il browser ha prodotto nell'editor (che può essere sporco: div, br, span...).
// Usa solo nodeType, nodeName, nodeValue, childNodes e getAttribute: si testa senza browser.

const BLOCK = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
  'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER',
]);

const tagOf = (n) => (n.nodeType === 1 ? String(n.nodeName).toUpperCase() : '');
const isBlockEl = (n) => BLOCK.has(tagOf(n));
const cleanText = (t) => String(t).replace(/ /g, ' ').replace(/[​﻿]/g, '').replace(/[\r\n\t]+/g, ' ');

function styleOf(n) {
  const s = typeof n.getAttribute === 'function' ? n.getAttribute('style') : null;
  return s ? String(s).toLowerCase() : '';
}

function collectInline(nodes, fmt, runs) {
  for (const n of nodes) {
    if (n.nodeType === 3) {
      runs.push({ text: cleanText(n.nodeValue), bold: fmt.bold, italic: fmt.italic });
    } else if (n.nodeType === 1) {
      const tag = tagOf(n);
      if (tag === 'BR') {
        runs.push({ text: ' ', bold: false, italic: false });
        continue;
      }
      const style = styleOf(n);
      const next = {
        bold: fmt.bold || tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(style),
        italic: fmt.italic || tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(style),
      };
      if (isBlockEl(n)) runs.push({ text: ' ', bold: false, italic: false });
      collectInline(n.childNodes, next, runs);
      if (isBlockEl(n)) runs.push({ text: ' ', bold: false, italic: false });
    }
  }
  return runs;
}

const hasText = (runs) => runs.some((r) => r.text.trim());

function pushBlock(out, type, runs) {
  const trimmed = trimRuns(normalizeRuns(runs));
  if (hasText(trimmed)) out.push({ type, runs: trimmed });
}

function handleBlock(el, out) {
  const tag = tagOf(el);
  if (tag === 'UL' || tag === 'OL') {
    const items = [];
    for (const li of el.childNodes) {
      if (tagOf(li) !== 'LI') continue;
      const runs = trimRuns(normalizeRuns(collectInline(li.childNodes, { bold: false, italic: false }, [])));
      if (hasText(runs)) items.push(runs);
    }
    if (items.length) out.push({ type: tag === 'UL' ? 'ul' : 'ol', items });
  } else if (/^H[1-6]$/.test(tag)) {
    pushBlock(out, 'h', collectInline(el.childNodes, { bold: false, italic: false }, []));
  } else {
    walkBlocks(el.childNodes, out);
  }
}

function walkBlocks(nodes, out) {
  let cur = [];
  const flush = () => {
    pushBlock(out, 'p', cur);
    cur = [];
  };
  for (const n of nodes) {
    if (isBlockEl(n)) {
      flush();
      handleBlock(n, out);
    } else if (tagOf(n) === 'BR') {
      flush();
    } else {
      collectInline([n], { bold: false, italic: false }, cur);
    }
  }
  flush();
}

/** Dall'elemento dell'editor ai blocchi (righe vuote ignorate). */
export function fromDom(root) {
  const out = [];
  walkBlocks(root.childNodes, out);
  return out;
}
