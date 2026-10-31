/**
 * M6 (v2.7.1): the error log trusted whatever JSON sat under `error_log`.
 * A non-array value made Diagnostics throw at render and made every later
 * `appendErrorLog` push onto a non-array. `clearErrorLog` was the one storage
 * call without a guard. Runs under jest and bun.
 */
import StorageService from '../storage';
import {appendErrorLog, clearErrorLog, getErrorLog} from '../errorLog';

const KEY = 'error_log';

beforeEach(() => {
  StorageService.removeItemSync(KEY);
});

describe('error log shape guards (M6)', () => {
  it('a non-array value renders as an empty log instead of throwing', () => {
    StorageService.setItemSync(KEY, '{"a":1}');
    expect(() => getErrorLog()).not.toThrow();
    expect(getErrorLog()).toEqual([]);
  });

  it('entries with the wrong shape are dropped, well-formed ones kept', () => {
    StorageService.setItemSync(
      KEY,
      JSON.stringify([
        {timestamp: '2026-10-26T00:00:00.000Z', message: 'ok', stack: '', fatal: false},
        {nope: true},
        'text',
        null,
        {timestamp: '2026-10-26T00:00:01.000Z', message: 'also ok', stack: 's', fatal: true},
      ]),
    );
    expect(getErrorLog().map(e => e.message)).toEqual(['ok', 'also ok']);
  });

  it('dropping malformed entries leaves a breadcrumb on the next append', () => {
    StorageService.setItemSync(
      KEY,
      JSON.stringify([{nope: true}, {timestamp: 't', message: 'ok', stack: '', fatal: false}]),
    );
    appendErrorLog(new Error('next'));
    expect(getErrorLog().map(e => e.message)).toEqual(['ok', 'error_log: dropped 1 malformed entry', 'next']);
  });

  it('appending onto a corrupt value starts a fresh array', () => {
    StorageService.setItemSync(KEY, '{"a":1}');
    appendErrorLog(new Error('after corruption'));
    expect(getErrorLog().map(e => e.message)).toEqual([
      'error_log: stored value was unreadable and was reset',
      'after corruption',
    ]);
  });

  it('clearErrorLog never throws, even when storage does', () => {
    const original = StorageService.removeItemSync;
    StorageService.removeItemSync = () => {
      throw new Error('storage gone');
    };
    try {
      expect(clearErrorLog()).toBe(false);
    } finally {
      StorageService.removeItemSync = original;
    }
  });
});

/**
 * M8 (v2.7.1): the log's header promises "no names", but a failed file read
 * embeds the picked file's URI — which on Android often carries the SAF
 * display name — in `error.message`. Paths are scrubbed before storing.
 */
describe('error log path scrubbing (M8)', () => {
  it('replaces content://, file:// and absolute storage paths in the message and stack with <path>', () => {
    const error = new Error(
      "ENOENT: no such file or directory, open 'content://com.android.providers.downloads.documents/document/msf%3A1234%20zero_backup_Indranil.json'",
    );
    error.stack = `Error: open 'file:///storage/emulated/0/Download/zero_v4_Indranil.json'\n    at readFile (/data/user/0/com.anotherwhy.zero/files/x.js:1:2)\n    at run (/var/mobile/Containers/Data/Application/ABC/tmp/y.js:3:4)`;
    appendErrorLog(error);
    const [entry] = getErrorLog();
    expect(entry?.message).toBe("ENOENT: no such file or directory, open '<path>'");
    expect(entry?.message).not.toContain('Indranil');
    expect(entry?.stack).not.toMatch(/content:|file:|\/storage\/|\/data\/|\/var\/mobile\//);
    expect(entry?.stack).toContain('<path>');
    expect(entry?.stack).toContain('readFile');
  });

  it('a quoted path with spaces in the file name is replaced whole', () => {
    appendErrorLog(new Error("ENOENT: open '/storage/emulated/0/Download/zero backup Ada Lovelace.json'"));
    appendErrorLog(
      new Error('open "/private/var/mobile/Library/Mobile Documents/com~apple~CloudDocs/zero Ada.json" failed'),
    );
    appendErrorLog(new Error('The file “zero backup Ada.json” couldn’t be opened: /sdcard/Download/x.json, retry'));
    const messages = getErrorLog().map(e => e.message);
    expect(messages[0]).toBe("ENOENT: open '<path>'");
    expect(messages[1]).toBe('open "<path>" failed');
    expect(messages[2]).toBe('The file “<name>” couldn’t be opened: <path>, retry');
    expect(messages.join(' ')).not.toContain('Ada');
  });

  it('an apostrophe inside a quoted file name does not end the path early', () => {
    appendErrorLog(new Error('no such file "/storage/emulated/0/Download/Ada\'s zero backup.json"'));
    appendErrorLog(new Error("open failed: 'content://com.android.providers/document/Ada's backup.json': EACCES"));
    const messages = getErrorLog().map(e => e.message);
    expect(messages).toEqual(['no such file "<path>"', "open failed: '<path>': EACCES"]);
  });

  it('keeps Hermes release frames and scrubs entries stored before 2.7.1 on read', () => {
    StorageService.setItemSync(
      KEY,
      JSON.stringify([
        {
          timestamp: 't',
          message: "open 'content://x/zero Ada.json'",
          stack: 'goBack@1:1924824\nanonymous@1:22',
          fatal: false,
        },
      ]),
    );
    const [old] = getErrorLog();
    expect(old?.message).toBe("open '<path>'");
    expect(old?.stack).toBe('goBack@1:1924824\nanonymous@1:22');
  });

  it('leaves messages without paths untouched', () => {
    appendErrorLog(new Error('expense/fetchByMonth: database is locked'));
    expect(getErrorLog()[0]?.message).toBe('expense/fetchByMonth: database is locked');
  });
});

describe('appendErrorLog takes any thrown value (M12)', () => {
  it('records a thrown string or object by content, so callers need not wrap it', () => {
    clearErrorLog();
    appendErrorLog('disk full');
    appendErrorLog({code: 'E_PICKER', detail: 'cancelled'});
    expect(getErrorLog().map(e => e.message)).toEqual(['disk full', '{"code":"E_PICKER","detail":"cancelled"}']);
  });
});
