// PIN numerico di riserva. Non si salva mai il PIN: solo la sua «impronta digitale» (hash)
// con PBKDF2, un sale casuale e molte ripetizioni, che rendono lento provare i PIN uno per uno.
//
// Formato salvato: "pbkdf2$<ripetizioni>$<sale>$<hash>"

import { fromB64u, toB64u } from './b64.js';

export const PIN_MIN = 4;
export const PIN_MAX = 8;
export const PBKDF2_ITERATIONS = 210_000;

export const isValidPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function createPinRecord(pin, iterations = PBKDF2_ITERATIONS) {
  if (!isValidPin(pin)) throw new Error(`Il PIN deve avere da ${PIN_MIN} a ${PIN_MAX} cifre.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, iterations);
  return `pbkdf2$${iterations}$${toB64u(salt)}$${toB64u(hash)}`;
}

export function isPinRecord(record) {
  return typeof record === 'string' && /^pbkdf2\$\d{1,9}\$[\w-]+\$[\w-]+$/.test(record);
}

export async function verifyPin(pin, record) {
  if (!isValidPin(pin) || !isPinRecord(record)) return false;
  const [, iterations, salt, expected] = record.split('$');
  const actual = await derive(pin, fromB64u(salt), Number(iterations));
  const want = fromB64u(expected);
  if (actual.length !== want.length) return false;
  let diff = 0; // confronto a tempo costante
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ want[i];
  return diff === 0;
}
