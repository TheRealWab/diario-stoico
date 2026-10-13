// Controllo locale di una risposta WebAuthn (impronta). Nessun server: l'app controlla da sola che
// la risposta sia davvero firmata dalla chiave registrata e che l'utente sia stato verificato
// (impronta o blocco schermo del telefono). Non usa il DOM, quindi si prova con i test.

import { fromB64u } from './b64.js';

export const ALG_ES256 = -7;
export const ALG_RS256 = -257;

const FLAG_UP = 0x01; // l'utente era presente
const FLAG_UV = 0x04; // l'utente è stato verificato

const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Firma ECDSA da formato DER a "r||s" (64 byte), come la vuole WebCrypto. */
export function derToRaw(der, size = 32) {
  const bytes = new Uint8Array(der);
  if (bytes[0] !== 0x30) throw new Error('Firma non valida.');
  let pos = 2 + (bytes[1] & 0x80 ? bytes[1] & 0x7f : 0);
  const readInt = () => {
    if (bytes[pos] !== 0x02) throw new Error('Firma non valida.');
    const len = bytes[pos + 1];
    let value = bytes.slice(pos + 2, pos + 2 + len);
    pos += 2 + len;
    while (value.length > size && value[0] === 0) value = value.slice(1);
    const out = new Uint8Array(size);
    out.set(value, size - value.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  return Uint8Array.from([...r, ...s]);
}

/**
 * Verifica una risposta di accesso. Restituisce { ok, reason }.
 *   publicKey: chiave pubblica in formato SPKI (come la dà getPublicKey())
 *   challenge: la sfida inviata (byte); rpId/origin: sito atteso
 */
export async function verifyAssertion({ publicKey, alg, challenge, authenticatorData, clientDataJSON, signature, rpId, origin }) {
  try {
    const authData = new Uint8Array(authenticatorData);
    const clientBytes = new Uint8Array(clientDataJSON);
    const client = JSON.parse(new TextDecoder().decode(clientBytes));

    if (client.type !== 'webauthn.get') return { ok: false, reason: 'tipo di risposta inatteso' };
    if (!same(fromB64u(client.challenge), new Uint8Array(challenge))) return { ok: false, reason: 'sfida diversa' };
    if (client.origin !== origin) return { ok: false, reason: 'sito diverso' };

    if (authData.length < 37) return { ok: false, reason: 'dati incompleti' };
    const rpIdHash = await sha256(new TextEncoder().encode(rpId));
    if (!same(authData.slice(0, 32), rpIdHash)) return { ok: false, reason: 'sito diverso' };
    const flags = authData[32];
    if (!(flags & FLAG_UP) || !(flags & FLAG_UV)) return { ok: false, reason: 'utente non verificato' };

    const signed = new Uint8Array([...authData, ...(await sha256(clientBytes))]);
    const spki = new Uint8Array(publicKey);
    let valid;
    if (alg === ALG_ES256) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(signature), signed);
    } else if (alg === ALG_RS256) {
      const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, new Uint8Array(signature), signed);
    } else {
      return { ok: false, reason: 'algoritmo non supportato' };
    }
    return valid ? { ok: true, reason: null } : { ok: false, reason: 'firma non valida' };
  } catch (err) {
    return { ok: false, reason: String(err?.message ?? err) };
  }
}
