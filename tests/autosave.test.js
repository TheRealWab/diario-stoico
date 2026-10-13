import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaver, flushAll, pendingCount } from '../js/autosave.js';

test('salva una sola volta dopo una raffica di modifiche, con il testo più recente', async () => {
  let text = '';
  const saved = [];
  const saver = createSaver(async () => saved.push(text), { delay: 20 });
  for (const t of ['a', 'ab', 'abc']) {
    text = t;
    saver.schedule();
  }
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(saved, ['abc']);
  assert.equal(pendingCount(), 0);
});

test('flush salva subito, senza aspettare', async () => {
  const saved = [];
  const saver = createSaver(async () => saved.push('x'), { delay: 10_000 });
  saver.schedule();
  assert.equal(pendingCount(), 1);
  await saver.flush();
  assert.deepEqual(saved, ['x']);
  await saver.flush(); // niente da salvare: non richiama
  assert.deepEqual(saved, ['x']);
});

test('flushAll (visibilitychange / pagehide) salva tutti i salvatori in attesa', async () => {
  const saved = [];
  const a = createSaver(async () => saved.push('a'), { delay: 10_000 });
  const b = createSaver(async () => saved.push('b'), { delay: 10_000 });
  a.schedule();
  b.schedule();
  await flushAll();
  assert.deepEqual(saved.sort(), ['a', 'b']);
  assert.equal(pendingCount(), 0);
});

test('se il salvataggio fallisce il testo resta da salvare e riprova', async () => {
  let fail = true;
  const states = [];
  const saver = createSaver(
    async () => {
      if (fail) throw new Error('disco pieno');
    },
    { delay: 10_000, onState: (s) => states.push(s) },
  );
  saver.schedule();
  await saver.flush();
  assert.equal(states.at(-1), 'errore');
  assert.equal(pendingCount(), 1);
  fail = false;
  await flushAll();
  assert.equal(states.at(-1), 'salvato');
  assert.equal(pendingCount(), 0);
});
