// Impostazioni: un unico record nello store "settings".

import { get, update } from './db.js';
import { nowIso } from './util.js';

export const SETTINGS_ID = 'main';

export const THEMES = ['carta', 'scuro', 'sistema'];
export const FONTS = ['serif', 'sans'];
export const FONT_SIZES = ['s', 'm', 'l', 'xl'];

// I campi delle fasi future (blocco, moduli, accento) ci sono già: niente migrazione dopo.
export const DEFAULT_SETTINGS = Object.freeze({
  id: SETTINGS_ID,
  theme: 'carta',
  accent: 'terracotta',
  font: 'serif',
  fontSize: 'm',
  lockEnabled: false,
  pinHash: null,
  enabledModules: [],
  lastBackupDate: null, // "AAAA-MM-GG" locale
});

const ENUMS = { theme: THEMES, font: FONTS, fontSize: FONT_SIZES };

/** Controlla i valori; restituisce la lista dei problemi (vuota se tutto ok). */
export function checkSettings(s) {
  const problems = [];
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in s && !allowed.includes(s[key])) problems.push(`Impostazione "${key}" non valida: ${s[key]}`);
  }
  if ('lastBackupDate' in s && s.lastBackupDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.lastBackupDate)) {
    problems.push('Data dell\'ultimo backup non valida.');
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
