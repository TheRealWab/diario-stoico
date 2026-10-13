// Backup cifrato con password.
//
// • La password NON viene salvata da nessuna parte: né nel telefono né nel file.
// • Dalla password si ricava una chiave con PBKDF2-SHA256 (molte ripetizioni, sale casuale):
//   rende lento provare password a caso.
// • Il contenuto è cifrato con AES-256-GCM: oltre a nasconderlo, scopre se il file è stato alterato.
// • Tutto con gli strumenti del browser (WebCrypto): nessuna libreria, nessuna rete.
//
// Il file cifrato è un JSON con questa forma (dei dati del diario non si vede nulla):
//   { app, encrypted: true, format: 1, kdf: { name, iterations, salt }, cipher: { name, iv }, data }

import { fromB64u, toB64u } from './b64.js';
import { APP_ID } from './util.js';

export const ENCRYPTED_FORMAT = 1;
export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 10;

const MIN_ACCEPTED_ITERATIONS = 100_000; // sotto questa soglia un file non viene accettato
const MAX_ACCEPTED_ITERATIONS = 5_000_000; // e sopra questa neppure (evita file che bloccano il telefono)
const AAD = new TextEncoder().encode(`${APP_ID}:cifrato:${ENCRYPTED_FORMAT}`);

export class BackupCryptoError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'weak-password' | 'wrong-password' | 'invalid-file'
  }
}

export function isEncryptedBackup(file) {
  return typeof file === 'object' && file !== null && !Array.isArray(file) && file.app === APP_ID && file.encrypted === true;
}

// La stessa password scritta da tastiere diverse deve dare lo stesso risultato.
const passwordBytes = (password) => new TextEncoder().encode(String(password).normalize('NFKC'));

async function deriveKey(password, salt, iterations, usage) {
  const base = await crypto.subtle.importKey('raw', passwordBytes(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, usage);
}

/** Cifra un backup (l'oggetto di buildExport) e restituisce l'oggetto da scrivere nel file. */
export async function encryptBackup(backup, password, { iterations = KDF_ITERATIONS } = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new BackupCryptoError('weak-password', `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations, ['encrypt']);
  const plain = new TextEncoder().encode(JSON.stringify(backup));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plain));
  return {
    app: APP_ID,
    encrypted: true,
    format: ENCRYPTED_FORMAT,
    kdf: { name: 'PBKDF2-SHA256', iterations, salt: toB64u(salt) },
    cipher: { name: 'AES-256-GCM', iv: toB64u(iv) },
    data: toB64u(cipher),
  };
}

function readEnvelope(file, minIterations) {
  const bad = () => new BackupCryptoError('invalid-file', 'Il file cifrato non è valido.');
  try {
    if (!isEncryptedBackup(file) || file.format !== ENCRYPTED_FORMAT) throw bad();
    const { kdf, cipher } = file;
    if (kdf?.name !== 'PBKDF2-SHA256' || cipher?.name !== 'AES-256-GCM') throw bad();
    if (!Number.isInteger(kdf.iterations) || kdf.iterations < minIterations || kdf.iterations > MAX_ACCEPTED_ITERATIONS) throw bad();
    const salt = fromB64u(kdf.salt);
    const iv = fromB64u(cipher.iv);
    const data = fromB64u(file.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16) throw bad();
    return { salt, iv, data, iterations: kdf.iterations };
  } catch (err) {
    throw err instanceof BackupCryptoError ? err : bad();
  }
}

/**
 * Decifra un file cifrato e restituisce il backup (da passare a validateImport).
 * Password sbagliata e file alterato non si distinguono: l'errore è lo stesso.
 */
export async function decryptBackup(file, password, { minIterations = MIN_ACCEPTED_ITERATIONS } = {}) {
  const { salt, iv, data, iterations } = readEnvelope(file, minIterations);
  let plain;
  try {
    const key = await deriveKey(password, salt, iterations, ['decrypt']);
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, data);
  } catch {
    throw new BackupCryptoError('wrong-password', 'Password errata, oppure il file è stato alterato.');
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new BackupCryptoError('invalid-file', 'Il file cifrato non è valido.');
  }
}
