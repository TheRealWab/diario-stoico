import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { fromB64u, toB64u } from '../js/b64.js';
import { createPinRecord, isPinRecord, isValidPin, verifyPin } from '../js/pin.js';
import { EMPTY_LOCKOUT, FREE_ATTEMPTS, delayAfter, loadLockout, recordFailure, remainingMs, saveLockout } from '../js/lockout.js';
import { GRACE_MS, shouldRelock } from '../js/lockpolicy.js';
import { ALG_ES256, derToRaw, verifyAssertion } from '../js/webauthn-verify.js';
import { DEFAULT_SETTINGS, LOCK_KEYS, checkSettings, getSettings, saveSettings } from '../js/settings.js';
import { createEntry } from '../js/entries.js';
import { buildExport, importData, validateImport } from '../js/backup.js';
import { getAll } from '../js/db.js';

// ---------- base64 ----------

test('base64 url-safe: andata e ritorno, senza + / =', () => {
  const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255, 1, 2]);
  const text = toB64u(bytes);
  assert.ok(!/[+/=]/.test(text));
  assert.deepEqual(fromB64u(text), bytes);
  assert.deepEqual(fromB64u(toB64u(new Uint8Array(0))), new Uint8Array(0));
});

// ---------- PIN ----------

test('PIN: validità (4-8 cifre)', () => {
  for (const ok of ['1234', '000000', '12345678']) assert.ok(isValidPin(ok), ok);
  for (const bad of ['123', '123456789', '12a4', '', ' 1234', null, 1234]) assert.ok(!isValidPin(bad), String(bad));
});

test('PIN: si salva solo l\'impronta digitale, si verifica quello giusto e basta', async () => {
  const record = await createPinRecord('482913', 1000);
  assert.ok(isPinRecord(record));
  assert.ok(!record.includes('482913'));
  assert.ok(await verifyPin('482913', record));
  assert.ok(!(await verifyPin('482914', record)));
  assert.ok(!(await verifyPin('48291', record)));
  assert.ok(!(await verifyPin('482913', 'testo-a-caso')));
});

test('PIN: lo stesso PIN produce record diversi (sale casuale)', async () => {
  const [a, b] = [await createPinRecord('1234', 1000), await createPinRecord('1234', 1000)];
  assert.notEqual(a, b);
  assert.ok(await verifyPin('1234', a) && (await verifyPin('1234', b)));
});

test('PIN non valido rifiutato alla creazione', async () => {
  await assert.rejects(createPinRecord('12'));
  await assert.rejects(createPinRecord('abcd'));
});

// ---------- tentativi sbagliati ----------

test('attesa crescente dopo cinque errori', () => {
  assert.equal(delayAfter(FREE_ATTEMPTS - 1), 0);
  assert.equal(delayAfter(5), 30_000);
  assert.equal(delayAfter(6), 60_000);
  assert.equal(delayAfter(7), 120_000);
  assert.equal(delayAfter(50), 900_000); // tetto: 15 minuti
});

test('recordFailure e remainingMs', () => {
  let s = EMPTY_LOCKOUT;
  for (let i = 0; i < 4; i++) s = recordFailure(s, 1000);
  assert.equal(remainingMs(s, 1000), 0);
  s = recordFailure(s, 1000);
  assert.equal(s.failures, 5);
  assert.equal(remainingMs(s, 1000), 30_000);
  assert.equal(remainingMs(s, 1000 + 10_000), 20_000);
  assert.equal(remainingMs(s, 1000 + 31_000), 0);
});

test('i tentativi si ricordano in localStorage (anche se non disponibile)', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.deepEqual(loadLockout(storage), { failures: 0, until: 0 });
  saveLockout({ failures: 6, until: 99 }, storage);
  assert.deepEqual(loadLockout(storage), { failures: 6, until: 99 });
  saveLockout({ failures: 0, until: 0 }, storage);
  assert.deepEqual(loadLockout(storage), { failures: 0, until: 0 });
  assert.deepEqual(loadLockout(null), { failures: 0, until: 0 }); // nessuna memoria: non si rompe
  store.set('ds-lockout', '{rotto');
  assert.deepEqual(loadLockout(storage), { failures: 0, until: 0 });
});

// ---------- quando si richiude ----------

test('si richiude solo se il blocco è attivo e si è stati via più di un minuto', () => {
  const base = { lockEnabled: true, hiddenAt: 1_000_000, graceMs: GRACE_MS };
  assert.equal(shouldRelock({ ...base, now: 1_000_000 + 59_000 }), false);
  assert.equal(shouldRelock({ ...base, now: 1_000_000 + 61_000 }), true);
  assert.equal(shouldRelock({ ...base, lockEnabled: false, now: 9_999_999 }), false);
  assert.equal(shouldRelock({ ...base, hiddenAt: null, now: 9_999_999 }), false);
  assert.equal(shouldRelock({ ...base, now: 1_000_000 - 5_000 }), true); // orologio tornato indietro
});

// ---------- impronta (WebAuthn) ----------

const RP_ID = 'therealwab.github.io';
const ORIGIN = 'https://therealwab.github.io';

function rawToDer(raw) {
  const int = (b) => {
    let v = [...b];
    while (v.length > 1 && v[0] === 0) v.shift();
    if (v[0] & 0x80) v.unshift(0);
    return [0x02, v.length, ...v];
  };
  const body = [...int(raw.slice(0, 32)), ...int(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

async function fakeAuthenticator({ flags = 0x05, rpId = RP_ID, origin = ORIGIN, type = 'webauthn.get', challengeOverride } = {}) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', publicKey));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type, challenge: toB64u(challengeOverride ?? challenge), origin }));
  const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  const authenticatorData = new Uint8Array([...rpIdHash, flags, 0, 0, 0, 1]);
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
  const raw = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new Uint8Array([...authenticatorData, ...clientHash])),
  );
  return {
    publicKey: spki, alg: ALG_ES256, challenge, authenticatorData, clientDataJSON, signature: rawToDer(raw), rpId: RP_ID, origin: ORIGIN,
  };
}

test('derToRaw: firma DER → r||s di 64 byte, anche con zeri iniziali e byte alti', () => {
  const raw = new Uint8Array(64).map((_, i) => (i === 0 ? 0x00 : i === 32 ? 0xff : i + 1));
  assert.deepEqual(derToRaw(rawToDer(raw)), raw);
  const raw2 = new Uint8Array(64).fill(0x7f);
  assert.deepEqual(derToRaw(rawToDer(raw2)), raw2);
});

test('impronta: una risposta valida viene accettata', async () => {
  const a = await fakeAuthenticator();
  assert.deepEqual(await verifyAssertion(a), { ok: true, reason: null });
});

test('impronta: risposte non valide vengono respinte', async () => {
  const good = await fakeAuthenticator();
  const reject = async (patch, why) => {
    const r = await verifyAssertion({ ...good, ...patch });
    assert.equal(r.ok, false, why);
  };
  await reject({ challenge: crypto.getRandomValues(new Uint8Array(32)) }, 'sfida diversa');
  await reject({ origin: 'https://altro.example' }, 'sito diverso');
  await reject({ rpId: 'altro.example' }, 'rpId diverso');
  const sig = new Uint8Array(good.signature);
  sig[sig.length - 1] ^= 0x01;
  await reject({ signature: sig }, 'firma alterata');
  const tampered = new Uint8Array(good.clientDataJSON);
  tampered[tampered.length - 3] ^= 0x01;
  await reject({ clientDataJSON: tampered }, 'dati alterati');
  await reject({ authenticatorData: new Uint8Array(10) }, 'dati troppo corti');
  await reject({ alg: -8 }, 'algoritmo non supportato');
  const other = await fakeAuthenticator();
  await reject({ publicKey: other.publicKey }, 'chiave diversa');
});

test('impronta: se l\'utente non è stato verificato (flag UV assente) si respinge', async () => {
  assert.equal((await verifyAssertion(await fakeAuthenticator({ flags: 0x01 }))).ok, false);
  assert.equal((await verifyAssertion(await fakeAuthenticator({ flags: 0x04 }))).ok, false);
  assert.equal((await verifyAssertion(await fakeAuthenticator({ type: 'webauthn.create' }))).ok, false);
});

// ---------- impostazioni del blocco e backup ----------

test('impostazioni: valori del blocco controllati', async () => {
  assert.deepEqual(checkSettings({ lockEnabled: true, pinHash: await createPinRecord('1234', 1000), webauthn: { id: 'a', publicKey: 'b', alg: -7 } }), []);
  assert.ok(checkSettings({ lockEnabled: 'sì' }).length);
  assert.ok(checkSettings({ pinHash: '1234' }).length);
  assert.ok(checkSettings({ webauthn: { id: 'a' } }).length);
  assert.deepEqual(LOCK_KEYS, ['lockEnabled', 'pinHash', 'webauthn']);
});

async function lockedDb() {
  const db = await freshDb();
  await createEntry(db, { date: '2026-10-13', time: '09:00', content: 'segreto' });
  const pinHash = await createPinRecord('1234', 1000);
  await saveSettings(db, { lockEnabled: true, pinHash, webauthn: { id: 'cred', publicKey: 'pub', alg: -7 }, theme: 'scuro' });
  return { db, pinHash };
}

test('il backup NON contiene PIN né impronta', async () => {
  const { db } = await lockedDb();
  const file = await buildExport(db);
  const [settings] = file.data.settings;
  for (const k of LOCK_KEYS) assert.ok(!(k in settings), `${k} nel file`);
  assert.equal(settings.theme, 'scuro');
  assert.ok(!JSON.stringify(file).includes('cred'));
  db.close();
});

test('importare (sostituisci o unisci) non cambia il blocco di questo telefono', async () => {
  const { db, pinHash } = await lockedDb();
  const source = await freshDb();
  await createEntry(source, { date: '2026-01-01', time: '10:00', content: 'altro' });
  await saveSettings(source, { theme: 'carta', fontSize: 'xl' });
  const file = JSON.parse(JSON.stringify(await buildExport(source)));
  // un file "malevolo" che prova a spegnere il blocco o a metterne uno suo
  file.data.settings[0].lockEnabled = false;
  file.data.settings[0].pinHash = null;

  for (const mode of ['merge', 'replace']) {
    const check = validateImport(file);
    assert.ok(check.ok, check.errors.join());
    await importData(db, check.data, mode);
    const s = await getSettings(db);
    assert.equal(s.lockEnabled, true, mode);
    assert.equal(s.pinHash, pinHash, mode);
    assert.deepEqual(s.webauthn, { id: 'cred', publicKey: 'pub', alg: -7 }, mode);
  }
  assert.equal((await getSettings(db)).fontSize, 'xl'); // le altre impostazioni arrivano dal file
  assert.equal((await getAll(db, 'entries')).length, 1); // "sostituisci" ha messo il diario del file
  db.close();
  source.close();
});

test('un backup senza impostazioni, in "sostituisci", non toglie il blocco', async () => {
  const { db, pinHash } = await lockedDb();
  await importData(db, { entries: [], settings: [] }, 'replace');
  const s = await getSettings(db);
  assert.equal(s.lockEnabled, true);
  assert.equal(s.pinHash, pinHash);
  db.close();
});

test('importare in un telefono senza blocco lascia il blocco spento', async () => {
  const source = (await lockedDb()).db;
  const file = JSON.parse(JSON.stringify(await buildExport(source)));
  const fresh = await freshDb();
  await importData(fresh, validateImport(file).data, 'replace');
  const s = await getSettings(fresh);
  assert.equal(s.lockEnabled, false);
  assert.equal(s.pinHash, null);
  assert.equal(s.webauthn, null);
  assert.equal(DEFAULT_SETTINGS.lockEnabled, false);
  source.close();
  fresh.close();
});
