import {isEncryptedBackupBase64} from '../vault';

/**
 * Picks the bytes of a backup file apart from the screen (L6, v2.7.1): the
 * size guard runs BEFORE the file is read, because the picker accepts any
 * file type and reading a mis-picked video into a string OOMs Hermes.
 *
 * 3.0 (P10): an encrypted backup (`.zbak`, docs/BACKUP_FORMAT.md) is
 * recognised by its first bytes, whatever its name, and handed back as base64
 * for the passphrase step; everything else must be JSON as before. The bytes
 * are read first: a text read of a binary file throws in react-native-fs.
 */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

interface PickedFile {
  /** `string` from the picker; `undefined` only for callers that build this by hand. */
  uri: string | undefined;
  name: string | null;
  /**
   * Bytes as reported by the picker; null when the provider does not say
   * (some SAF/cloud providers), in which case the size guard is bypassed.
   */
  size: number | null;
  /** A provider-side error the picker attached to this entry. */
  error?: string | null;
}

type LoadedBackup =
  | {ok: true; kind: 'json'; json: unknown}
  | {ok: true; kind: 'encrypted'; base64: string}
  | {ok: false; reason: 'invalidPath' | 'tooLarge' | 'invalidJson'; sizeBytes?: number}
  | {ok: false; reason: 'unreadable'; cause: unknown};

/** Strips the `file:` scheme and percent-encoding; '' when the uri is missing or undecodable. @internal test */
export const normalizeBackupPath = (uri: string | undefined): string => {
  if (uri === undefined) {
    return '';
  }
  const withoutScheme = uri.startsWith('file:') ? uri.substring('file:'.length) : uri;
  try {
    return decodeURI(withoutScheme);
  } catch {
    // Malformed percent-encoding: there is no path to read.
    return '';
  }
};

export const loadBackupFile = async (
  file: PickedFile,
  readFile: (path: string, encoding: 'utf8' | 'base64') => Promise<string>,
): Promise<LoadedBackup> => {
  const path = normalizeBackupPath(file.uri);
  if (!path) {
    return {ok: false, reason: 'invalidPath'};
  }
  if (file.size !== null && file.size > MAX_IMPORT_BYTES) {
    return {ok: false, reason: 'tooLarge', sizeBytes: file.size};
  }
  if (file.error) {
    // Not the provider's text: on iOS it quotes the file's display name (M8).
    return {ok: false, reason: 'unreadable', cause: new Error('picker: the provider reported an error for this file')};
  }
  let contents: string;
  try {
    const base64 = await readFile(path, 'base64');
    if (isEncryptedBackupBase64(base64)) {
      return {ok: true, kind: 'encrypted', base64};
    }
    contents = await readFile(path, 'utf8');
  } catch (cause) {
    // Permission, a virtual (cloud-only) document, a revoked grant: nothing
    // was synced, so this must not read as a failed sync.
    return {ok: false, reason: 'unreadable', cause};
  }
  try {
    return {ok: true, kind: 'json', json: JSON.parse(contents)};
  } catch {
    return {ok: false, reason: 'invalidJson'};
  }
};
