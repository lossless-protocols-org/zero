/**
 * Picks the bytes of a backup file apart from the screen (L6, v2.7.1): the
 * size guard runs BEFORE the file is read, because the picker accepts any
 * file type and reading a mis-picked video into a string OOMs Hermes.
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
  | {ok: true; json: unknown}
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
  readFile: (path: string) => Promise<string>,
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
    contents = await readFile(path);
  } catch (cause) {
    // Permission, a virtual (cloud-only) document, a revoked grant: nothing
    // was synced, so this must not read as a failed sync.
    return {ok: false, reason: 'unreadable', cause};
  }
  try {
    return {ok: true, json: JSON.parse(contents)};
  } catch {
    return {ok: false, reason: 'invalidJson'};
  }
};
