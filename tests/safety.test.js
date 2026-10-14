import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computePrecache } from '../tools/precache.mjs';

const root = new URL('../', import.meta.url);
const jsFiles = computePrecache().files.filter((f) => f.startsWith('js/'));

// Toglie le stringhe, così le parentesi dentro i testi non confondono il conteggio.
const withoutStrings = (src) => src.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');

/** Gli argomenti di ogni chiamata a `.replaceChildren(…)`, tenendo solo ciò che sta al livello più esterno. */
function topLevelArguments(src) {
  const code = withoutStrings(src);
  const calls = [];
  const needle = '.replaceChildren(';
  let at = code.indexOf(needle);
  while (at !== -1) {
    let depth = 1;
    let top = '';
    let i = at + needle.length;
    while (i < code.length && depth > 0) {
      const c = code[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (depth === 1) top += c;
      i++;
    }
    calls.push({ top, line: code.slice(0, at).split('\n').length, whole: code.slice(at, i) });
    at = code.indexOf(needle, i);
  }
  return calls;
}

test('replaceChildren non riceve valori che possono essere null (comparirebbe il testo «null»): si usa setChildren()', () => {
  const risky = [];
  for (const file of jsFiles) {
    for (const { top, whole, line } of topLevelArguments(readFileSync(new URL(file, root), 'utf8'))) {
      // un valore condizionale direttamente tra gli argomenti: dentro h(…) i vuoti sono ignorati, qui no
      const conditional = /\bnull\b|\bundefined\b|\?|&&|\|\|/.test(top);
      if (conditional && !whole.includes('.filter(Boolean)')) risky.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(risky, [], `Usa setChildren() da dom.js in: ${risky.join(', ')}`);
});

test('il controllo riconosce davvero i casi pericolosi (e lascia stare quelli sicuri)', () => {
  const bad = topLevelArguments('el.replaceChildren(a, cond ? b : null);')[0];
  assert.ok(/\?/.test(bad.top));
  const safeNested = topLevelArguments("el.replaceChildren(h('div', {}, cond ? b : null));")[0];
  assert.ok(!/\?|\bnull\b/.test(safeNested.top));
  const safeText = topLevelArguments("el.replaceChildren(h('p', {}, 'a ? b (c)'));")[0];
  assert.ok(!/\?/.test(safeText.top));
  const risky = topLevelArguments('el.replaceChildren(x && y);')[0];
  assert.ok(/&&/.test(risky.top));
});
