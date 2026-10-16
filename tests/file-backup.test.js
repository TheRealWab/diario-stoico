import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { KINDS, canReuseFile, fileChoiceAvailable, forgetFile, getRememberedFile, rememberFile, writeToFile } from '../js/file-backup.js';

// un finto «file scelto»: registra ciò che gli si scrive, come fa quello vero
function fakeHandle({ failWrite = false, permission = 'granted', missing = false } = {}) {
  const log = { content: 'vecchio', aborted: false, closed: false };
  return {
    log,
    name: 'diario-stoico-2026-10-13.json',
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    getFile: async () => {
      if (missing) throw new DOMException('non trovato', 'NotFoundError');
      return {};
    },
    createWritable: async () => {
      let pending = '';
      return {
        write: async (text) => {
          if (failWrite) throw new Error('disco pieno');
          pending = text;
        },
        abort: async () => {
          log.aborted = true; // il vecchio contenuto resta
        },
        close: async () => {
          log.content = pending;
          log.closed = true;
        },
      };
    },
  };
}

test('senza la scelta del file (come in questi test) si ripiega sul download', () => {
  assert.equal(fileChoiceAvailable(), false);
});

test('il file scelto si ricorda, uno per tipo di backup, e si può dimenticare', async () => {
  assert.equal(await getRememberedFile(KINDS.plain), null);
  await rememberFile(KINDS.plain, { name: 'semplice.json' });
  await rememberFile(KINDS.encrypted, { name: 'diario-cifrato.json' });
  assert.equal((await getRememberedFile(KINDS.plain)).name, 'semplice.json');
  assert.equal((await getRememberedFile(KINDS.encrypted)).name, 'diario-cifrato.json'); // mai scambiati
  await rememberFile(KINDS.plain, { name: 'altro.json' }); // sostituisce il riferimento, non ne aggiunge
  assert.equal((await getRememberedFile(KINDS.plain)).name, 'altro.json');
  await forgetFile(KINDS.plain);
  assert.equal(await getRememberedFile(KINDS.plain), null);
  assert.equal((await getRememberedFile(KINDS.encrypted)).name, 'diario-cifrato.json');
});

test('scrivere sul file sostituisce il contenuto vecchio', async () => {
  const handle = fakeHandle();
  await writeToFile(handle, '{"nuovo":true}');
  assert.equal(handle.log.content, '{"nuovo":true}');
  assert.equal(handle.log.closed, true);
});

test('se la scrittura fallisce il vecchio contenuto resta e l\'errore arriva a chi chiama', async () => {
  const handle = fakeHandle({ failWrite: true });
  await assert.rejects(writeToFile(handle, 'x'), /disco pieno/);
  assert.equal(handle.log.aborted, true);
  assert.equal(handle.log.closed, false);
  assert.equal(handle.log.content, 'vecchio');
});

test('il file di prima si riusa solo se c\'è il permesso e il file esiste ancora', async () => {
  assert.equal(await canReuseFile(fakeHandle()), true);
  assert.equal(await canReuseFile(fakeHandle({ permission: 'denied' })), false);
  assert.equal(await canReuseFile(fakeHandle({ missing: true })), false); // spostato o cancellato
});
