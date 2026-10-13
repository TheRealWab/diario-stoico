// Impronta digitale tramite WebAuthn («passkey» del telefono), usata solo come cancello locale.
// Android mostra il suo schermo di sicurezza (impronta o, in alternativa, il blocco schermo del telefono).
// Non c'è nessun server: la risposta viene controllata dall'app (vedi webauthn-verify.js).

import { fromB64u, toB64u } from './b64.js';
import { ALG_ES256, ALG_RS256, verifyAssertion } from './webauthn-verify.js';

const TIMEOUT_MS = 60_000;
const rpId = () => location.hostname;
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function fingerprintAvailable() {
  try {
    return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}

/** Registra l'impronta su questo telefono. Restituisce { id, publicKey, alg } da salvare nelle impostazioni. */
export async function registerFingerprint() {
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Diario Stoico', id: rpId() },
      user: { id: randomBytes(16), name: 'diario', displayName: 'Diario Stoico' },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: ALG_ES256 },
        { type: 'public-key', alg: ALG_RS256 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      timeout: TIMEOUT_MS,
    },
  });
  const response = credential?.response;
  const publicKey = response?.getPublicKey?.();
  const alg = response?.getPublicKeyAlgorithm?.();
  if (!publicKey || (alg !== ALG_ES256 && alg !== ALG_RS256)) {
    throw new Error('Questo telefono non permette di usare l’impronta in questa app.');
  }
  return { id: toB64u(credential.rawId), publicKey: toB64u(publicKey), alg };
}

/** Chiede l'impronta. Restituisce true solo se la risposta è valida; false se annullata o non riconosciuta. */
export async function authenticateFingerprint(stored) {
  const challenge = randomBytes(32);
  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: rpId(),
        allowCredentials: [{ type: 'public-key', id: fromB64u(stored.id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: TIMEOUT_MS,
      },
    });
  } catch {
    return false; // annullata, sensore non riconosce il dito, ecc.
  }
  if (!assertion) return false;
  const { ok } = await verifyAssertion({
    publicKey: fromB64u(stored.publicKey),
    alg: stored.alg,
    challenge,
    authenticatorData: assertion.response.authenticatorData,
    clientDataJSON: assertion.response.clientDataJSON,
    signature: assertion.response.signature,
    rpId: rpId(),
    origin: location.origin,
  });
  return ok;
}
