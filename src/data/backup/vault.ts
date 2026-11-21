import {z} from 'zod';
import NativeBackup from '../../native/specs/NativeBackup';

/**
 * The encrypted backup's native side (3.0, plan P10; docs/BACKUP_FORMAT.md),
 * the one importer of NativeBackup. Every answer from native code is checked
 * here before the app sees it, and every failure becomes a named reason.
 * Tier-blind (L1): writing is Pro's to decide (src/pro/autoBackup.ts), and
 * opening a file is never gated.
 */

/** The first bytes of every encrypted backup ("ZEROBAK"). */
const MAGIC = 'ZEROBAK';
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Whether a file read as base64 is an encrypted backup. Decided on the bytes:
 * a file is read as base64 first because react-native-fs decodes a "utf8"
 * read with a strict UTF-8 decoder, which throws on the binary of a `.zbak`
 * (found on the Moto, 2026-11-11). Only the first 12 characters (9 bytes) are
 * decoded.
 */
export const isEncryptedBackupBase64 = (base64: string): boolean => {
  let bits = 0;
  let value = 0;
  let text = '';
  for (const char of base64.slice(0, 12)) {
    if (char === '=') {
      break; // padding: the bytes end here
    }
    const digit = BASE64.indexOf(char);
    if (digit < 0) {
      return false;
    }
    // Six bits in per character, one byte out per eight: kept below 2^14, so plain arithmetic is exact.
    value = value * 64 + digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      text += String.fromCharCode(Math.floor(value / 2 ** bits));
      value %= 2 ** bits;
    }
  }
  return text.startsWith(MAGIC);
};

export type FolderState =
  | {state: 'none'}
  | {
      state: 'ok' | 'lost';
      /** Android: 'phone' | 'sdCard'; iOS: 'device' | 'icloud'. */
      volume: string;
      /** The folder's path or name, as the platform gives it. */
      path: string;
      /** zero's backup files in it (0 when lost). */
      files: number;
    };

const folderSchema = z.union([
  z.object({state: z.literal('none')}),
  z.object({
    state: z.enum(['ok', 'lost']),
    volume: z.string(),
    path: z.string(),
    files: z.number().int().nonnegative().optional(),
  }),
]);

/** The error code a native rejection carries (RN puts it on `code`). */
const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export type ChooseOutcome = 'chosen' | 'cancelled' | 'notOnDevice' | 'unavailable';

/** Shows the system folder picker; on Android only a folder on the phone is accepted. */
export const chooseBackupFolder = async (): Promise<ChooseOutcome> => {
  if (!NativeBackup) {
    return 'unavailable';
  }
  const result = z
    .object({outcome: z.enum(['chosen', 'cancelled', 'notOnDevice'])})
    .safeParse(parse(await NativeBackup.chooseFolder()));
  return result.success ? result.data.outcome : 'cancelled';
};

/** The chosen folder and how many backups are in it. A folder that cannot be read is 'lost'. */
export const backupFolder = async (): Promise<FolderState> => {
  if (!NativeBackup) {
    return {state: 'none'};
  }
  const result = folderSchema.safeParse(parse(await NativeBackup.folder()));
  if (!result.success) {
    return {state: 'none'};
  }
  const value = result.data;
  return value.state === 'none' ? value : {...value, files: value.files ?? 0};
};

/** Derives and keeps the key for `passphrase` (about a second). Files written before keep their old passphrase. */
export const setBackupPassphrase = async (passphrase: string): Promise<boolean> => {
  if (!NativeBackup) {
    return false;
  }
  await NativeBackup.setPassphrase(passphrase);
  return true;
};

export type WriteResult =
  | {ok: true; fileName: string; bytes: number}
  | {ok: false; reason: 'folderLost' | 'noKey' | 'failed' | 'unavailable'; cause?: unknown};

/** Encrypts `json` and writes it as `day`'s backup in the folder, keeping the newest `keepDays` days. */
export const writeEncryptedBackup = async (json: string, day: string, keepDays: number): Promise<WriteResult> => {
  if (!NativeBackup) {
    return {ok: false, reason: 'unavailable'};
  }
  try {
    const result = z
      .object({fileName: z.string(), bytes: z.number()})
      .safeParse(parse(await NativeBackup.write(json, day, keepDays)));
    return result.success
      ? {ok: true, ...result.data}
      : {ok: false, reason: 'failed', cause: new Error('backup: the write answered something else')};
  } catch (cause) {
    const code = codeOf(cause);
    return {ok: false, reason: code === 'folderLost' || code === 'noKey' ? code : 'failed', cause};
  }
};

export type DecryptResult =
  | {ok: true; text: string}
  | {ok: false; reason: 'wrongPassphrase' | 'notBackup' | 'newerFormat' | 'damaged' | 'unavailable'};

const DECRYPT_REASONS = new Set(['wrongPassphrase', 'notBackup', 'newerFormat', 'damaged']);

/** The JSON inside an encrypted backup (the file as base64). Never gated: a Free install opens a Pro backup. */
export const decryptBackup = async (base64: string, passphrase: string): Promise<DecryptResult> => {
  if (!NativeBackup) {
    return {ok: false, reason: 'unavailable'};
  }
  try {
    return {ok: true, text: await NativeBackup.decrypt(base64, passphrase)};
  } catch (error) {
    const code = codeOf(error);
    return {
      ok: false,
      reason:
        code !== undefined && DECRYPT_REASONS.has(code)
          ? (code as 'wrongPassphrase' | 'notBackup' | 'newerFormat' | 'damaged') // checked against the set just above
          : 'damaged',
    };
  }
};

/** Forgets the folder and the key. The files stay where they are. */
export const forgetBackupSetup = async (): Promise<void> => {
  await NativeBackup?.forget();
};

/** iOS: time to finish a backup the app is leaving. Release it with `releaseBackground`. */
export const holdBackground = async (): Promise<number> => (NativeBackup ? NativeBackup.holdBackground() : 0);

export const releaseBackground = async (token: number): Promise<void> => {
  if (token !== 0) {
    await NativeBackup?.releaseBackground(token);
  }
};
