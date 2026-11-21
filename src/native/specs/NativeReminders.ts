import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Local reminders for recurring rules (3.0, plan P9), on both platforms, with
 * the platforms' own APIs and no library: iOS `ios/zero/Reminders/
 * ZeroReminders.mm` (UNUserNotificationCenter); Android `bridge/
 * RemindersModule.kt` (AlarmManager, inexact, and a receiver that posts the
 * notification; a boot receiver re-arms them from the stored list, so they
 * survive a restart without the app being opened). Nothing leaves the phone.
 * src/pro/reminders.ts is the only importer.
 */
/** @internal codegen — RN codegen reads this to generate NativeRemindersSpec. */
export interface Spec extends TurboModule {
  /** 'granted' | 'denied' | 'undetermined'. */
  permission(): Promise<string>;
  /** iOS asks the user (once; later calls answer as `permission`). Android: PermissionsAndroid asks, in JS. */
  requestPermission(): Promise<string>;
  /**
   * Replaces every reminder zero has pending with these: a JSON array of
   * `{id, title, body, fireAtMs}`. '[]' cancels them all.
   */
  replaceAll(json: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativeReminders');
