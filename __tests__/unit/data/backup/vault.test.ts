/**
 * The encrypted backup's gateway (plan P10): every answer from the native
 * module is checked, every failure becomes a named reason, and without the
 * module (a build without it, jest) nothing throws.
 */
import {
  backupFolder,
  chooseBackupFolder,
  decryptBackup,
  forgetBackupSetup,
  holdBackground,
  isEncryptedBackupBase64,
  releaseBackground,
  setBackupPassphrase,
  writeEncryptedBackup,
} from '../../../../src/data/backup/vault';

/** The native module as this suite sets it: null (none) unless a test gives one. */
const mockNative: {current: Record<string, jest.Mock> | null} = {current: null};
jest.mock('../../../../src/native/specs/NativeBackup', () => ({
  __esModule: true,
  get default() {
    return mockNative.current;
  },
}));

const rejection = (code: string) => Object.assign(new Error('native'), {code});

const native = (methods: Record<string, jest.Mock>) => {
  mockNative.current = methods;
  return methods;
};

afterEach(() => {
  mockNative.current = null;
});

it('recognises an encrypted backup by its first bytes, read as base64', () => {
  const b64 = (bytes: string) => Buffer.from(bytes, 'binary').toString('base64');
  expect(isEncryptedBackupBase64(b64('ZEROBAK\u0001\u0001\u0000\u0009\u00ff\u00fe'))).toBe(true);
  expect(isEncryptedBackupBase64(b64('ZEROBAK'))).toBe(true);
  expect(isEncryptedBackupBase64(b64('{"key":"zeroAbc","version":6}'))).toBe(false);
  expect(isEncryptedBackupBase64(b64('ZEROBA'))).toBe(false);
  expect(isEncryptedBackupBase64('')).toBe(false);
  expect(isEncryptedBackupBase64('Wk*ST0JBSwEB')).toBe(false);
});

describe('without the native module', () => {
  it('says unavailable, or nothing, and never throws', async () => {
    await expect(chooseBackupFolder()).resolves.toBe('unavailable');
    await expect(backupFolder()).resolves.toEqual({state: 'none'});
    await expect(setBackupPassphrase('long enough')).resolves.toBe(false);
    await expect(writeEncryptedBackup('{}', '2026-11-11', 14)).resolves.toEqual({ok: false, reason: 'unavailable'});
    await expect(decryptBackup('WkVST0JBSw==', 'x')).resolves.toEqual({ok: false, reason: 'unavailable'});
    await expect(forgetBackupSetup()).resolves.toBeUndefined();
    await expect(holdBackground()).resolves.toBe(0);
    await expect(releaseBackground(3)).resolves.toBeUndefined();
  });
});

describe('the folder', () => {
  it('passes on what the picker chose, and reads anything else as cancelled', async () => {
    const {chooseFolder} = native({chooseFolder: jest.fn()});
    chooseFolder?.mockResolvedValueOnce('{"outcome":"chosen"}');
    await expect(chooseBackupFolder()).resolves.toBe('chosen');
    chooseFolder?.mockResolvedValueOnce('{"outcome":"notOnDevice"}');
    await expect(chooseBackupFolder()).resolves.toBe('notOnDevice');
    chooseFolder?.mockResolvedValueOnce('{"outcome":"maybe"}');
    await expect(chooseBackupFolder()).resolves.toBe('cancelled');
    chooseFolder?.mockResolvedValueOnce('not json');
    await expect(chooseBackupFolder()).resolves.toBe('cancelled');
  });

  it('describes the folder; a lost one has no files; an answer it cannot read is no folder', async () => {
    const {folder} = native({folder: jest.fn()});
    folder?.mockResolvedValueOnce('{"state":"ok","volume":"phone","path":"Documents/zero","files":3}');
    await expect(backupFolder()).resolves.toEqual({state: 'ok', volume: 'phone', path: 'Documents/zero', files: 3});
    folder?.mockResolvedValueOnce('{"state":"lost","volume":"icloud","path":"zero"}');
    await expect(backupFolder()).resolves.toEqual({state: 'lost', volume: 'icloud', path: 'zero', files: 0});
    folder?.mockResolvedValueOnce('{"state":"none"}');
    await expect(backupFolder()).resolves.toEqual({state: 'none'});
    folder?.mockResolvedValueOnce('{"state":"ok"}');
    await expect(backupFolder()).resolves.toEqual({state: 'none'});
  });
});

describe('writing', () => {
  it('returns the file written', async () => {
    const {write} = native({write: jest.fn(async () => '{"fileName":"zero-backup-2026-11-11.zbak","bytes":812}')});
    await expect(writeEncryptedBackup('{"a":1}', '2026-11-11', 14)).resolves.toEqual({
      ok: true,
      fileName: 'zero-backup-2026-11-11.zbak',
      bytes: 812,
    });
    expect(write).toHaveBeenCalledWith('{"a":1}', '2026-11-11', 14);
  });

  it('names a lost folder and a missing key; anything else is a failure with its cause', async () => {
    const {write} = native({write: jest.fn()});
    write?.mockRejectedValueOnce(rejection('folderLost'));
    await expect(writeEncryptedBackup('{}', '2026-11-11', 7)).resolves.toMatchObject({ok: false, reason: 'folderLost'});
    write?.mockRejectedValueOnce(rejection('noKey'));
    await expect(writeEncryptedBackup('{}', '2026-11-11', 7)).resolves.toMatchObject({ok: false, reason: 'noKey'});
    write?.mockRejectedValueOnce(new Error('disk full'));
    const failed = await writeEncryptedBackup('{}', '2026-11-11', 7);
    expect(failed).toMatchObject({ok: false, reason: 'failed'});
    expect(!failed.ok && String(failed.cause)).toContain('disk full');
    write?.mockResolvedValueOnce('{"fileName":1}');
    await expect(writeEncryptedBackup('{}', '2026-11-11', 7)).resolves.toMatchObject({ok: false, reason: 'failed'});
  });
});

describe('opening a file', () => {
  it('returns the JSON inside', async () => {
    const {decrypt} = native({decrypt: jest.fn(async () => '{"key":"x"}')});
    await expect(decryptBackup('AAAA', 'pass phrase')).resolves.toEqual({ok: true, text: '{"key":"x"}'});
    expect(decrypt).toHaveBeenCalledWith('AAAA', 'pass phrase');
  });

  it.each(['wrongPassphrase', 'notBackup', 'newerFormat', 'damaged'])('passes on %s', async code => {
    native({decrypt: jest.fn(async () => Promise.reject(rejection(code)))});
    await expect(decryptBackup('AAAA', 'x')).resolves.toEqual({ok: false, reason: code});
  });

  it('reads an unknown failure as a damaged file', async () => {
    native({decrypt: jest.fn(async () => Promise.reject(new Error('boom')))});
    await expect(decryptBackup('AAAA', 'x')).resolves.toEqual({ok: false, reason: 'damaged'});
  });
});

it('sets the passphrase, forgets, and holds and releases the app on the way out', async () => {
  const methods = native({
    setPassphrase: jest.fn(async () => undefined),
    forget: jest.fn(async () => undefined),
    holdBackground: jest.fn(async () => 42),
    releaseBackground: jest.fn(async () => undefined),
  });
  await expect(setBackupPassphrase('correct horse')).resolves.toBe(true);
  expect(methods['setPassphrase']).toHaveBeenCalledWith('correct horse');
  await forgetBackupSetup();
  expect(methods['forget']).toHaveBeenCalled();
  await expect(holdBackground()).resolves.toBe(42);
  await releaseBackground(42);
  expect(methods['releaseBackground']).toHaveBeenCalledWith(42);
  // 0 is "nothing was held" (Android, or iOS refused): nothing to release.
  await releaseBackground(0);
  expect(methods['releaseBackground']).toHaveBeenCalledTimes(1);
});
