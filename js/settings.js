// Impostazioni: un unico record nello store "settings".

import { get, update } from './db.js';
import { isPinRecord } from './pin.js';
import { nowIso } from './util.js';

export const SETTINGS_ID = 'main';

export const THEMES = ['carta', 'scuro', 'sistema'];
export const FONTS = ['serif', 'sans'];
export const FONT_SIZES = ['s', 'm', 'l', 'xl'];
export const LINE_SPACINGS = ['s', 'm', 'l', 'xl']; // compatta, normale, ampia, molto ampia

// I campi delle fasi future (moduli, accento) ci sono già: niente migrazione dopo.
export const DEFAULT_SETTINGS = Object.freeze({
  id: SETTINGS_ID,
  theme: 'carta',
  accent: 'terracotta',
  font: 'serif',
  fontSize: 'm',
  lineSpacing: 'm',
  lockEnabled: false,
  pinHash: null, // impronta digitale (hash) del PIN, mai il PIN
  webauthn: null, // { id, publicKey, alg } dell'impronta registrata su questo telefono
  enabledModules: [], // id dei moduli attivi di base (vedi modules.js: finché modulesConfigured è falso c'è solo «goals»)
  modulesConfigured: false, // diventa vero alla prima scelta nelle impostazioni dei moduli
  lastBackupDate: null, // "AAAA-MM-GG" locale
});

const ENUMS = { theme: THEMES, font: FONTS, fontSize: FONT_SIZES, lineSpacing: LINE_SPACINGS };

// Dati del blocco: legati a QUESTO telefono. Non finiscono nei backup e un'importazione non li tocca.
export const LOCK_KEYS = ['lockEnabled', 'pinHash', 'webauthn'];

/** Controlla i valori; restituisce la lista dei problemi (vuota se tutto ok). */
export function checkSettings(s) {
  const problems = [];
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in s && !allowed.includes(s[key])) problems.push(`Impostazione "${key}" non valida: ${s[key]}`);
  }
  if ('lastBackupDate' in s && s.lastBackupDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.lastBackupDate)) {
    problems.push('Data dell\'ultimo backup non valida.');
  }
  if ('enabledModules' in s && (!Array.isArray(s.enabledModules) || s.enabledModules.length > 200 || s.enabledModules.some((id) => typeof id !== 'string' || !id))) {
    problems.push('Impostazione "enabledModules" non valida.');
  }
  if ('modulesConfigured' in s && typeof s.modulesConfigured !== 'boolean') problems.push('Impostazione "modulesConfigured" non valida.');
  if ('lockEnabled' in s && typeof s.lockEnabled !== 'boolean') problems.push('Impostazione "lockEnabled" non valida.');
  if ('pinHash' in s && s.pinHash !== null && !isPinRecord(s.pinHash)) problems.push('Impostazione "pinHash" non valida.');
  if ('webauthn' in s && s.webauthn !== null) {
    const w = s.webauthn;
    const ok = w && typeof w.id === 'string' && typeof w.publicKey === 'string' && (w.alg === -7 || w.alg === -257);
    if (!ok) problems.push('Impostazione "webauthn" non valida.');
  }
  return problems;
}

/** Impostazioni complete: i campi mancanti prendono il valore predefinito. */
export async function getSettings(db) {
  const stored = await get(db, 'settings', SETTINGS_ID);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(db, patch, now = new Date()) {
  const problems = checkSettings(patch);
  if (problems.length) throw new Error(problems[0]);
  const stamp = nowIso(now);
  return update(db, 'settings', SETTINGS_ID, (old) => ({
    ...DEFAULT_SETTINGS,
    createdAt: stamp,
    ...old,
    ...patch,
    id: SETTINGS_ID,
    updatedAt: stamp,
  }));
}
