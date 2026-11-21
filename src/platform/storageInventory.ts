import {StorageService} from './storage';

/**
 * Every MMKV key zero writes, and what "Delete all data" and a restore do
 * with it, in one place (audit 2026-11-08 §3.10). A key not listed here is
 * removed by the wipe; `__tests__/unit/platform/storageInventory.test.ts` fails when the
 * source defines a key this file does not classify, so a new key is a choice.
 *
 * Kept: what describes this install and this device rather than the user's
 * money: preferences, the migration bookkeeping, and Diagnostics. The widget
 * amounts switch stays because turning it back on by itself would show
 * figures the user chose to hide. @internal test
 */
export const KEPT_KEYS: ReadonlySet<string> = new Set([
  // the install
  'firstSeenAppVersion',
  // who is paying (3.0): a purchase belongs to the store account, not to the data being
  // deleted. It is only a copy of the store's answer and is replaced by the next one.
  'pro_entitlement',
  // 3.0: what this install has already been told once (the what's-new screen, the notice for
  // one ending of Pro). Deleting the data must not make the app say it again.
  'whats_new_3_0_seen',
  'pro_ended_notice_for',
  // P9: the phone was already asked to show reminders; the OS keeps that answer past a wipe too.
  'reminders_permission_asked',
  // set to false by the wipe itself, so the onboarding stack takes over
  'isOnboarded',
  // database migration state: the empty database is still on this schema
  'data_migration_version',
  'data_migration_retry_count',
  'data_migration_failed',
  'data_migration_failed_app_version',
  'database_schema_version',
  // Diagnostics, and which crash was last offered for a report
  'error_log',
  'crash_report_prompted_at',
  'crash_report_prompted_message',
  // preferences
  'themePreference',
  'user_locale_override',
  'weekStartDay',
  'amountCalculator',
  'swipeActionsEnabled',
  'listSort',
  'widgetShowAmounts',
  // P10: how many days of automatic backups the folder keeps, a preference like the rest
  'backup_keep_days',
  // a measurement of this device's keyboard, not a choice
  'quickAddKeyboardHeight',
]);

/**
 * Removed: what came from the user's data or their use of it. Listed so the
 * test can tell a deliberate removal from a forgotten key. @internal test
 */
export const CLEARED_PREFIXES: readonly string[] = [
  // years with expenses, per user id (the restore mints a new id, so old ones are orphans)
  'available-expense-years',
  // the swipe hints, shown again to whoever uses the app next
  'swipe_tutorial_seen_',
  // redux-persist's store from before 2.7.1; nothing reads it
  'persist:root',
  // P10: whether automatic backup is on, and its last result. A wipe turns it off: the next
  // backup would otherwise replace today's file with the emptied data. (A restore runs only
  // in onboarding, after a wipe or on a new install.) The folder and key are native and stay;
  // turning it on again asks for the passphrase.
  'auto_backup_',
];

/** Removes every key not in KEPT_KEYS; returns the removed keys (for tests and Diagnostics). */
export const wipeUserStorage = (): string[] => {
  const removed = StorageService.getAllKeys().filter(key => !KEPT_KEYS.has(key));
  for (const key of removed) {
    StorageService.removeItemSync(key);
  }
  return removed;
};
