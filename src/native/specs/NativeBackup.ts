import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * The encrypted backup (3.0, plan P10) on both platforms with their own APIs
 * and no library: the folder the user picked (Android's Storage Access
 * Framework, only on the phone; iOS's document picker with a saved bookmark,
 * On My iPhone or iCloud Drive), the key derived from the passphrase (Android
 * Keystore-wrapped; iOS Keychain), and the file format of
 * docs/BACKUP_FORMAT.md. iOS `ios/zero/Backup/ZeroBackup.mm` (Swift in
 * ios/ZeroBackup); Android `bridge/BackupModule.kt` (Kotlin in backup/).
 * zero makes no network call: iOS's Files, not zero, syncs an iCloud folder.
 * src/data/backup/vault.ts is the only importer.
 *
 * A failing call rejects with a code: `folderLost`, `noKey`, `failed` for a
 * write; `wrongPassphrase`, `notBackup`, `newerFormat`, `damaged` for decrypt.
 */
/** @internal codegen — RN codegen reads this to generate NativeBackupSpec. */
export interface Spec extends TurboModule {
  /** Shows the system folder picker. JSON `{outcome: 'chosen' | 'cancelled' | 'notOnDevice'}`. */
  chooseFolder(): Promise<string>;
  /** JSON `{state: 'none' | 'ok' | 'lost', volume?, path?, files?}`: the chosen folder and zero's files in it. */
  folder(): Promise<string>;
  /** Derives and keeps the key (a new salt each time). Slow on purpose: about a second. */
  setPassphrase(passphrase: string): Promise<void>;
  /** Encrypts `json`, writes it as `day`'s backup ('YYYY-MM-DD'), keeps the newest `keep` days. JSON `{fileName, bytes}`. */
  write(json: string, day: string, keep: number): Promise<string>;
  /** The JSON inside an encrypted file given as base64. */
  decrypt(base64: string, passphrase: string): Promise<string>;
  /** Forgets the folder and the key; the files stay where they are. */
  forget(): Promise<void>;
  /** iOS: asks for time to finish a backup the app is leaving (beginBackgroundTask). Android: 0. */
  holdBackground(): Promise<number>;
  releaseBackground(token: number): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativeBackup');
