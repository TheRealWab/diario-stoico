import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { freshDb } from './helpers.js';
import { askDataSection, backupReminder, reminderText, snoozeUntil, takeDataSection } from '../js/backup-reminder.js';
import { BACKUP_REMINDER_DAYS, DEFAULT_SETTINGS, checkSettings, getSettings, saveSettings } from '../js/settings.js';

const base = { backupReminderDays: 14, backupSnoozeUntil: null, lastBackupDate: null };
const today = '2026-11-13';

test('promemoria del backup: compare solo quando è passato il tempo scelto', () => {
  const s = { ...base, lastBackupDate: '2026-11-01' };
  assert.equal(backupReminder({ settings: s, today, firstDate: '2026-01-01' }), null); // 12 giorni: presto
  assert.deepEqual(backupReminder({ settings: s, today: '2026-11-15', firstDate: '2026-01-01' }), { never: false, days: 14 });
  assert.deepEqual(backupReminder({ settings: { ...s, backupReminderDays: 7 }, today, firstDate: null }), { never: false, days: 12 });
});

test('promemoria del backup: mai fatto → conta dal primo giorno scritto; diario vuoto → niente', () => {
  assert.equal(backupReminder({ settings: base, today, firstDate: null }), null);
  assert.equal(backupReminder({ settings: base, today, firstDate: '2026-11-05' }), null); // si scrive da 8 giorni: presto
  assert.deepEqual(backupReminder({ settings: base, today, firstDate: '2026-10-01' }), { never: true, days: 43 });
});

test('promemoria del backup: spento, oppure rimandato con «Non ora»', () => {
  const old = { ...base, lastBackupDate: '2026-08-01' };
  assert.equal(backupReminder({ settings: { ...old, backupReminderDays: 0 }, today, firstDate: '2026-01-01' }), null);
  const until = snoozeUntil(today);
  assert.equal(until, '2026-11-16');
  assert.equal(backupReminder({ settings: { ...old, backupSnoozeUntil: until }, today: '2026-11-15', firstDate: null }), null);
  assert.ok(backupReminder({ settings: { ...old, backupSnoozeUntil: until }, today: '2026-11-16', firstDate: null }));
});

test('promemoria del backup: la frase è un’informazione, senza rimproveri', () => {
  assert.equal(reminderText({ never: false, days: 20 }), 'L’ultimo backup è di 20 giorni fa. Il diario vive solo su questo telefono.');
  assert.match(reminderText({ never: true, days: 40 }), /^Non hai ancora fatto un backup\./);
  for (const text of [reminderText({ never: false, days: 20 }), reminderText({ never: true, days: 40 })]) assert.ok(!/devi|dovresti|!/.test(text));
});

test('«Fai il backup» chiede la parte Dati delle impostazioni, una volta sola', () => {
  assert.equal(takeDataSection(), false);
  askDataSection();
  assert.equal(takeDataSection(), true);
  assert.equal(takeDataSection(), false);
});

test('impostazioni del promemoria: valori di partenza, salvataggio e controlli', async () => {
  assert.equal(DEFAULT_SETTINGS.backupReminderDays, 14);
  assert.deepEqual(BACKUP_REMINDER_DAYS, [0, 7, 14, 30]);
  assert.deepEqual(checkSettings({ backupReminderDays: 30, backupSnoozeUntil: '2026-11-16' }), []);
  assert.equal(checkSettings({ backupReminderDays: 5 }).length, 1);
  assert.equal(checkSettings({ backupSnoozeUntil: 'domani' }).length, 1);
  const db = await freshDb();
  assert.equal((await getSettings(db)).backupReminderDays, 14); // anche per chi aveva già l'app: nessuna migrazione
  await saveSettings(db, { backupReminderDays: 0, backupSnoozeUntil: '2026-11-16' });
  const s = await getSettings(db);
  assert.equal(s.backupReminderDays, 0);
  assert.equal(s.backupSnoozeUntil, '2026-11-16');
  db.close();
});
