import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDom, normalizeRuns, parse, parseInline, serialize, serializeInline, toPlainText } from '../js/markdown.js';

const roundtrip = (md) => serialize(parse(md));

test('testo semplice e paragrafi', () => {
  assert.equal(roundtrip('Una riga.'), 'Una riga.');
  assert.equal(roundtrip('Uno\n\nDue\n\n\nTre'), 'Uno\n\nDue\n\nTre');
  assert.equal(roundtrip(''), '');
});

test('grassetto, corsivo e insieme', () => {
  assert.deepEqual(parseInline('a **b** *c* ***d*** e'), [
    { text: 'a ', bold: false, italic: false },
    { text: 'b', bold: true, italic: false },
    { text: ' ', bold: false, italic: false },
    { text: 'c', bold: false, italic: true },
    { text: ' ', bold: false, italic: false },
    { text: 'd', bold: true, italic: true },
    { text: ' e', bold: false, italic: false },
  ]);
  assert.equal(roundtrip('a **b** *c* ***d*** e'), 'a **b** *c* ***d*** e');
});

test('titoletti ed elenchi', () => {
  const md = '## Titolo\n\nTesto\n\n- uno\n- due\n\n1. primo\n2. secondo';
  assert.equal(roundtrip(md), md);
  assert.deepEqual(parse(md).map((b) => b.type), ['h', 'p', 'ul', 'ol']);
});

test('il grassetto dentro un titoletto non viene salvato', () => {
  const root = el('div', [el('h2', [el('b', [text('Esame serale')])])]);
  assert.equal(serialize(fromDom(root)), '## Esame serale');
});

test("l'elenco numerato viene rinumerato", () => {
  assert.equal(roundtrip('3. a\n7. b'), '1. a\n2. b');
});

test('caratteri speciali nel testo sopravvivono (escape)', () => {
  const blocks = [
    { type: 'p', runs: [{ text: 'a * b ** c \\ d', bold: false, italic: false }] },
    { type: 'p', runs: [{ text: '- non un elenco', bold: false, italic: false }] },
    { type: 'p', runs: [{ text: '## non un titolo', bold: false, italic: false }] },
    { type: 'p', runs: [{ text: '1. non un elenco', bold: false, italic: false }] },
  ];
  assert.deepEqual(parse(serialize(blocks)), blocks);
});

test('spazi ai bordi del grassetto finiscono fuori dai simboli', () => {
  const runs = [{ text: 'parola ', bold: true, italic: false }, { text: 'dopo', bold: false, italic: false }];
  assert.equal(serializeInline(runs), '**parola** dopo');
  assert.deepEqual(normalizeRuns([{ text: '  ', bold: true }]), [{ text: '  ', bold: false, italic: false }]);
});

test('formati annidati e sovrapposti si riscrivono senza perdere nulla', () => {
  const runs = [
    { text: 'a', bold: true, italic: false },
    { text: 'b', bold: true, italic: true },
    { text: 'c', bold: false, italic: true },
    { text: ' d', bold: false, italic: false },
  ];
  assert.deepEqual(parseInline(serializeInline(runs)), normalizeRuns(runs));
});

test('toPlainText toglie i simboli', () => {
  assert.equal(toPlainText('## Titolo\n\nUn **testo** *vario*\n\n- uno\n- due'), 'Titolo\nUn testo vario\nuno\ndue');
});

// --- DOM finto: basta a provare fromDom senza browser ---
const text = (s) => ({ nodeType: 3, nodeValue: s });
const el = (tag, children = [], attrs = {}) => ({
  nodeType: 1, nodeName: tag.toUpperCase(), childNodes: children,
  getAttribute: (k) => attrs[k] ?? null,
});
const md = (root) => serialize(fromDom(root));

test('fromDom: struttura pulita', () => {
  const root = el('div', [
    el('h2', [text('Titolo')]),
    el('p', [text('Ciao '), el('strong', [text('mondo')]), text(' e '), el('em', [text('luna')])]),
    el('ul', [el('li', [text('uno')]), el('li', [text('due')])]),
    el('ol', [el('li', [text('primo')])]),
  ]);
  assert.equal(md(root), '## Titolo\n\nCiao **mondo** e *luna*\n\n- uno\n- due\n\n1. primo');
});

test('fromDom: roba sporca tipica di contenteditable', () => {
  const root = el('div', [
    text('Testo senza blocco'),
    el('div', [text('Riga in un div'), el('br')]),
    el('div', [el('br')]), // riga vuota: ignorata
    el('p', [el('b', [text('grasso')]), text(' vero')]),
    el('p', [el('span', [text('grasso via stile')], { style: 'font-weight: 700;' })]),
    el('p', [text('uno'), el('br'), text('due')]), // a capo morbido -> due paragrafi
    el('div', [el('i', [text('annidato')])]),
  ]);
  assert.equal(
    md(root),
    'Testo senza blocco\n\nRiga in un div\n\n**grasso** vero\n\n**grasso via stile**\n\nuno\n\ndue\n\n*annidato*',
  );
});

test('fromDom: spazi non separabili e caratteri invisibili', () => {
  const root = el('div', [el('p', [text('  ciao  mondo ​')])]);
  assert.equal(md(root), 'ciao  mondo');
});

test('fromDom: editor vuoto o con soli a capo non produce blocchi', () => {
  assert.deepEqual(fromDom(el('div', [])), []);
  assert.deepEqual(fromDom(el('div', [el('p', [el('br')]), el('p', [el('br')])])), []);
});

test("fromDom: il testo con simboli Markdown non viene interpretato", () => {
  const root = el('div', [el('p', [text('**non grassetto** - e # e 1. ')])]);
  const reparsed = parse(md(root));
  assert.deepEqual(reparsed, [{ type: 'p', runs: [{ text: '**non grassetto** - e # e 1.', bold: false, italic: false }] }]);
});
