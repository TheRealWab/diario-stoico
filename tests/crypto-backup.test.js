import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { BackupCryptoError, KDF_ITERATIONS, MIN_PASSWORD_LENGTH, decryptBackup, encryptBackup, isEncryptedBackup } from '../js/crypto-backup.js';
import { buildExport, exportFilename, importData, validateImport } from '../js/backup.js';
import { createEntry } from '../js/entries.js';
import { saveSettings } from '../js/settings.js';
import { getAll } from '../js/db.js';
import { STORES } from '../js/migrations.js';

const PW = 'una frase lunga e segreta';
const FAST = { iterations: 1000 };
const OPEN = { minIterations: 1000 };
const sample = { app: 'diario-stoico', schemaVersion: 1, exportedAt: '2026-10-13T10:00:00.000Z', data: { entries: [{ id: 'a', content: 'segretissimo àèì “ciao” 🌿' }] } };

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (err) => err instanceof BackupCryptoError && err.code === code, `atteso ${code}`);
}

test('andata e ritorno: si riottiene esattamente il backup', async () => {
  const file = await encryptBackup(sample, PW, FAST);
  assert.deepEqual(await decryptBackup(file, PW, OPEN), sample);
});

test('il file cifrato non contiene nulla del diario', async () => {
  const file = await encryptBackup(sample, PW, FAST);
  const text = JSON.stringify(file);
  for (const secret of ['segretissimo', 'entries', 'content', '2026-10-13', 'schemaVersion', PW]) {
    assert.ok(!text.includes(secret), `compare "${secret}"`);
  }
  assert.equal(file.app, 'diario-stoico');
  assert.ok(isEncryptedBackup(file));
  assert.ok(!isEncryptedBackup(sample));
});

test('lo stesso backup cifrato due volte dà file diversi (sale e IV casuali)', async () => {
  const [a, b] = [await encryptBackup(sample, PW, FAST), await encryptBackup(sample, PW, FAST)];
  assert.notEqual(a.kdf.salt, b.kdf.salt);
  assert.notEqual(a.cipher.iv, b.cipher.iv);
  assert.notEqual(a.data, b.data);
});

test('password sbagliata: errore, anche se differisce di un carattere o di maiuscole', async () => {
  const file = await encryptBackup(sample, PW, FAST);
  for (const wrong of ['', 'password sbagliata', `${PW}.`, PW.toUpperCase(), PW.slice(1)]) {
    await rejectsWith(decryptBackup(file, wrong, OPEN), 'wrong-password');
  }
});

test('file alterato (dati, IV, sale, ripetizioni): viene scoperto', async () => {
  const file = await encryptBackup(sample, PW, FAST);
  const flip = (b64) => (b64[0] === 'A' ? 'B' : 'A') + b64.slice(1);
  const variants = {
    dati: { ...file, data: flip(file.data) },
    iv: { ...file, cipher: { ...file.cipher, iv: flip(file.cipher.iv) } },
    sale: { ...file, kdf: { ...file.kdf, salt: flip(file.kdf.salt) } },
    ripetizioni: { ...file, kdf: { ...file.kdf, iterations: file.kdf.iterations + 1 } },
  };
  for (const [name, bad] of Object.entries(variants)) {
    await assert.rejects(decryptBackup(bad, PW, OPEN), BackupCryptoError, name);
  }
});

test('file malformati o con parametri pericolosi vengono respinti prima di lavorare', async () => {
  const file = await encryptBackup(sample, PW, FAST);
  const bads = [
    { ...file, format: 2 },
    { ...file, encrypted: false },
    { ...file, kdf: { ...file.kdf, name: 'altro' } },
    { ...file, kdf: { ...file.kdf, iterations: 10 } }, // troppo poche: il file sembra indebolito
    { ...file, kdf: { ...file.kdf, iterations: 2_000_000_000 } }, // troppe: bloccherebbe il telefono
    { ...file, kdf: { ...file.kdf, salt: 'AAAA' } },
    { ...file, cipher: { ...file.cipher, iv: 'AAAA' } },
    { ...file, data: 'AAAA' },
    { app: 'altra-app', encrypted: true },
    null,
    [],
  ];
  for (const bad of bads) {
    await rejectsWith(decryptBackup(bad, PW, OPEN), 'invalid-file');
  }
});

test('con le impostazioni di produzione il file dichiara almeno 600.000 ripetizioni', async () => {
  assert.ok(KDF_ITERATIONS >= 600_000);
  const file = await encryptBackup({ x: 1 }, PW);
  assert.equal(file.kdf.iterations, KDF_ITERATIONS);
  assert.deepEqual(await decryptBackup(file, PW), { x: 1 });
});

test('password troppo corta rifiutata', async () => {
  await rejectsWith(encryptBackup(sample, 'corta'), 'weak-password');
  await rejectsWith(encryptBackup(sample, 'a'.repeat(MIN_PASSWORD_LENGTH - 1)), 'weak-password');
  await rejectsWith(encryptBackup(sample, undefined), 'weak-password');
  assert.ok(await encryptBackup(sample, 'a'.repeat(MIN_PASSWORD_LENGTH), FAST));
});

test('la stessa password con accenti scritta in modi diversi funziona (normalizzazione Unicode)', async () => {
  const composta = 'perché è così bello'; // é come un solo carattere
  const scomposta = composta.normalize('NFD'); // e + accento separato
  assert.notEqual(composta, scomposta);
  const file = await encryptBackup(sample, composta, FAST);
  assert.deepEqual(await decryptBackup(file, scomposta, OPEN), sample);
});

test('nome del file cifrato', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  assert.equal(exportFilename(now), 'diario-stoico-2026-10-13.json');
  assert.equal(exportFilename(now, { encrypted: true }), 'diario-stoico-2026-10-13-cifrato.json');
});

test('giro completo: esporta, cifra, decifra, svuota, importa: tutto torna identico', async () => {
  const db = await freshDb();
  await createEntry(db, { date: '2026-10-12', time: '08:00', label: 'mattina', content: '## Ieri\n\nUn **bel** giorno' });
  await createEntry(db, { date: '2026-10-13', time: '21:10', content: 'sera: perché sì' });
  await saveSettings(db, { theme: 'scuro', fontSize: 'l' });
  const snap = async (d) => {
    const out = {};
    for (const s of Object.keys(STORES)) {
      out[s] = (await getAll(d, s)).sort((a, b) => String(a.id ?? a.date).localeCompare(String(b.id ?? b.date)));
    }
    return out;
  };

  const exported = await buildExport(db); // segna anche la data dell'ultimo backup
  const before = await snap(db);
  const encrypted = JSON.parse(JSON.stringify(await encryptBackup(exported, PW, FAST))); // passa da testo come il file vero
  assert.ok(!JSON.stringify(encrypted).includes('perché'));

  const other = await freshDb();
  const opened = await decryptBackup(encrypted, PW, OPEN);
  const check = validateImport(opened);
  assert.ok(check.ok, check.errors.join());
  await importData(other, check.data, 'replace');
  assert.deepEqual(await snap(other), before);
  db.close();
  other.close();
});
