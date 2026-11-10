/**
 * L6 (v2.7.1): the import picker accepted any file type and read it whole
 * into memory before looking at anything (`res.size` was never read). A
 * mis-picked video OOMs Hermes. Files above the limit are refused BEFORE the
 * read; the rest of the pre-validation path (bad uri, bad JSON) lives here
 * too so it can be exercised without the screen.
 */
import {
  MAX_IMPORT_BYTES,
  loadBackupFile,
  normalizeBackupPath,
} from '../../../../../src/data/backup/import/loadBackupFile';

const reader = (contents: string) => {
  const calls: string[] = [];
  const readFile = async (path: string): Promise<string> => {
    calls.push(path);
    return contents;
  };
  return {calls, readFile};
};

describe('normalizeBackupPath', () => {
  it('strips the file: scheme and percent-decoding, and fails closed on garbage', () => {
    expect(normalizeBackupPath('file:///storage/emulated/0/Download/zero%20v4.json')).toBe(
      '///storage/emulated/0/Download/zero v4.json',
    );
    expect(normalizeBackupPath('content://com.android.providers/document/123')).toBe(
      'content://com.android.providers/document/123',
    );
    expect(normalizeBackupPath(undefined)).toBe('');
    expect(normalizeBackupPath('file:///bad%E0%A4%A')).toBe('');
  });
});

describe('loadBackupFile', () => {
  it('refuses a file above the limit without reading it', async () => {
    const {calls, readFile} = reader('{}');
    const result = await loadBackupFile({uri: 'file:///x.mp4', name: 'x.mp4', size: 100 * 1024 * 1024}, readFile);
    expect(result).toEqual({ok: false, reason: 'tooLarge', sizeBytes: 100 * 1024 * 1024});
    expect(calls).toEqual([]);
  });

  it('the limit is 25 MB inclusive', async () => {
    const {calls, readFile} = reader('{"a":1}');
    await expect(
      loadBackupFile({uri: 'file:///a.json', name: 'a.json', size: MAX_IMPORT_BYTES}, readFile),
    ).resolves.toEqual({ok: true, json: {a: 1}});
    await expect(
      loadBackupFile({uri: 'file:///a.json', name: 'a.json', size: MAX_IMPORT_BYTES + 1}, readFile),
    ).resolves.toEqual({
      ok: false,
      reason: 'tooLarge',
      sizeBytes: MAX_IMPORT_BYTES + 1,
    });
    expect(calls).toHaveLength(1);
    expect(MAX_IMPORT_BYTES).toBe(25 * 1024 * 1024);
  });

  it('reads when the picker does not know the size (null)', async () => {
    const {calls, readFile} = reader('{"a":1}');
    await expect(loadBackupFile({uri: 'file:///a.json', name: 'a.json', size: null}, readFile)).resolves.toEqual({
      ok: true,
      json: {a: 1},
    });
    expect(calls).toEqual(['///a.json']);
  });

  it('reports a bad path and bad JSON as distinct reasons', async () => {
    const {calls, readFile} = reader('not json');
    await expect(loadBackupFile({uri: undefined, name: null, size: 10}, readFile)).resolves.toEqual({
      ok: false,
      reason: 'invalidPath',
    });
    expect(calls).toEqual([]);
    await expect(loadBackupFile({uri: 'file:///a.json', name: 'a.json', size: 10}, readFile)).resolves.toEqual({
      ok: false,
      reason: 'invalidJson',
    });
  });

  it('a file that cannot be read is "unreadable" with the cause, not a failed sync', async () => {
    const readFile = async (): Promise<string> => {
      throw new Error('EACCES');
    };
    const result = await loadBackupFile({uri: 'file:///a.json', name: 'a.json', size: 10}, readFile);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('unreadable');
    expect(!result.ok && result.reason === 'unreadable' && String(result.cause)).toContain('EACCES');
  });

  it('a provider-side error from the picker is unreadable too, without a read', async () => {
    const {calls, readFile} = reader('{}');
    const result = await loadBackupFile(
      {uri: 'file:///a.json', name: 'a.json', size: 10, error: 'Virtual file'},
      readFile,
    );
    expect(!result.ok && result.reason).toBe('unreadable');
    expect(calls).toEqual([]);
  });
});
