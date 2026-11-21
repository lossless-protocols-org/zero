/**
 * When the automatic backup writes (plan P10): on leaving with changes, on
 * opening when a day has passed with changes, and on "Back up now"; never
 * without Pro or with it turned off. What it remembers of the last attempt,
 * and that a change made during a backup keeps the next one due. The vault
 * (native) and the envelope builder are stand-ins; the database, MMKV and
 * the producer registry are real.
 */
import {AppState} from 'react-native';
import {database} from '../../../src/data/database/database';
import {todayIsoDay} from '../../../src/domain/dates';
import * as errorLog from '../../../src/platform/errorLog';
import {
  autoBackupDirtyPreference,
  autoBackupKeepPreference,
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../../../src/platform/backupPreferences';
import {backUpNow, noteChange, onLeave, onOpen, startAutoBackup} from '../../../src/pro/autoBackup';
import {reconcile} from '../../../src/pro/reconcile';
import type {Entitlement} from '../../../src/pro/schema';
import type {BackupJson} from '../../../src/data/backup/export/exportFiles';
import type {WriteResult} from '../../../src/data/backup/vault';
import {setEntitlement} from '../../harness/mocks/entitlement';

jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());
jest.mock('../../../src/platform/afterInteractions', () => ({
  afterInteractions: (work: () => void) => {
    work();
    return {cancel: () => undefined};
  },
}));

const mockBuild = jest.fn<Promise<BackupJson>, []>();
jest.mock('../../../src/data/backup/export/exportFiles', () => ({
  buildBackupJson: () => mockBuild(),
}));
const mockWrite = jest.fn<Promise<WriteResult>, [string, string, number]>();
const mockHold = jest.fn<Promise<number>, []>();
const mockRelease = jest.fn<Promise<void>, [number]>();
jest.mock('../../../src/data/backup/vault', () => ({
  writeEncryptedBackup: (json: string, day: string, keep: number) => mockWrite(json, day, keep),
  holdBackground: () => mockHold(),
  releaseBackground: (token: number) => mockRelease(token),
}));

const written: WriteResult = {ok: true, fileName: 'zero-backup.zbak', bytes: 10};
const pro = (state: Entitlement['state'] = 'lifetime') => setEntitlement({state});
const entitlement = (state: Entitlement['state']): Entitlement =>
  // Only the state is read here; the rest is the store's shape.
  ({state, expiresAtMs: null, endedAtMs: null}) as unknown as Entitlement;
const DAY = 86_400_000;

let logged: jest.SpyInstance;
beforeEach(() => {
  mockBuild.mockReset().mockResolvedValue({ok: true, json: '{"key":"x"}'});
  mockWrite.mockReset().mockResolvedValue(written);
  mockHold.mockReset().mockResolvedValue(7);
  mockRelease.mockReset().mockResolvedValue(undefined);
  autoBackupOnPreference.set(true);
  autoBackupKeepPreference.set('14');
  autoBackupLastAtPreference.set(0);
  autoBackupStatusPreference.set('none');
  autoBackupDirtyPreference.set(true);
  pro();
  logged = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
});
afterEach(() => logged.mockRestore());

describe('a backup', () => {
  it('writes today’s file with the days to keep, and remembers it', async () => {
    autoBackupKeepPreference.set('30');
    await expect(backUpNow()).resolves.toBe('written');
    expect(mockWrite).toHaveBeenCalledWith('{"key":"x"}', todayIsoDay(), 30);
    expect(autoBackupLastAtPreference.get()).toBeGreaterThan(0);
    expect(autoBackupStatusPreference.get()).toBe('ok');
    expect(autoBackupDirtyPreference.get()).toBe(false);
    // The time asked of iOS is given back.
    expect(mockRelease).toHaveBeenCalledWith(7);
  });

  it('a change made while it is written keeps the next backup due', async () => {
    mockWrite.mockImplementation(async () => {
      noteChange();
      return written;
    });
    await backUpNow();
    expect(autoBackupDirtyPreference.get()).toBe(true);
  });

  it('runs one at a time: a second call gets the first one’s result', async () => {
    const [a, b] = await Promise.all([backUpNow(), backUpNow()]);
    expect([a, b]).toEqual(['written', 'written']);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('with no user yet there is nothing to back up, and nothing is said', async () => {
    mockBuild.mockResolvedValue({ok: false, reason: 'noUser'});
    await expect(backUpNow()).resolves.toBe('skipped');
    expect(mockWrite).not.toHaveBeenCalled();
    expect(autoBackupStatusPreference.get()).toBe('none');
  });

  it('data that would not restore is a failure to show', async () => {
    mockBuild.mockResolvedValue({ok: false, reason: 'invalid', detail: 'expenses row 3'});
    await expect(backUpNow()).resolves.toBe('failed');
    expect(autoBackupStatusPreference.get()).toBe('failed');
  });

  it('a lost folder or key is shown in Settings; only an unexplained failure is logged', async () => {
    mockWrite.mockResolvedValueOnce({ok: false, reason: 'folderLost'});
    await expect(backUpNow()).resolves.toBe('folderLost');
    expect(autoBackupStatusPreference.get()).toBe('folderLost');
    mockWrite.mockResolvedValueOnce({ok: false, reason: 'noKey'});
    await expect(backUpNow()).resolves.toBe('noKey');
    expect(logged).not.toHaveBeenCalled();
    mockWrite.mockResolvedValueOnce({ok: false, reason: 'failed', cause: new Error('disk full')});
    await expect(backUpNow()).resolves.toBe('failed');
    mockWrite.mockResolvedValueOnce({ok: false, reason: 'failed'});
    await expect(backUpNow()).resolves.toBe('failed');
    expect(logged).toHaveBeenCalledTimes(2);
    // Nothing written: the last good backup's time stays.
    expect(autoBackupLastAtPreference.get()).toBe(0);
  });

  it('a build without the native module skips quietly', async () => {
    mockWrite.mockResolvedValue({ok: false, reason: 'unavailable'});
    await expect(backUpNow()).resolves.toBe('skipped');
    expect(autoBackupStatusPreference.get()).toBe('none');
  });

  it('a throw is a logged failure, and the time asked of iOS is still given back', async () => {
    mockBuild.mockRejectedValue(new Error('read failed'));
    mockHold.mockRejectedValue(new Error('no task'));
    mockRelease.mockRejectedValue(new Error('release failed'));
    await expect(backUpNow()).resolves.toBe('failed');
    expect(autoBackupStatusPreference.get()).toBe('failed');
    expect(mockRelease).toHaveBeenCalledWith(0);
    expect(logged).toHaveBeenCalledTimes(2);
  });
});

describe('on leaving', () => {
  it('backs up only with Pro, turned on, and something changed', async () => {
    autoBackupOnPreference.set(false);
    await expect(onLeave()).resolves.toBe('skipped');
    autoBackupOnPreference.set(true);
    pro('expired');
    await expect(onLeave()).resolves.toBe('skipped');
    pro('subscribed');
    autoBackupDirtyPreference.set(false);
    await expect(onLeave()).resolves.toBe('skipped');
    expect(mockWrite).not.toHaveBeenCalled();
    noteChange();
    await expect(onLeave()).resolves.toBe('written');
  });
});

describe('on opening', () => {
  it('backs up when something changed and the last backup is a day old', async () => {
    const now = 10 * DAY;
    autoBackupLastAtPreference.set(now - DAY + 1);
    await expect(onOpen(entitlement('lifetime'), now)).resolves.toBe('skipped');
    autoBackupLastAtPreference.set(now - DAY);
    await expect(onOpen(entitlement('expired'), now)).resolves.toBe('skipped');
    await expect(onOpen(entitlement('lifetime'), now)).resolves.toBe('written');
    // Nothing changed since: nothing to write, however old.
    await expect(onOpen(entitlement('lifetime'), now + 5 * DAY)).resolves.toBe('skipped');
  });
});

describe('once started', () => {
  let leaving: ((state: string) => void) | undefined;
  beforeAll(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      leaving = listener as (state: string) => void;
      return {remove: () => undefined} as ReturnType<typeof AppState.addEventListener>;
    });
    startAutoBackup();
    startAutoBackup(); // once per runtime
  });

  it('a write to the data makes the next backup due', async () => {
    autoBackupDirtyPreference.set(false);
    await database.write(async () => {
      await database.get('currencies').create(() => undefined);
    });
    expect(autoBackupDirtyPreference.get()).toBe(true);
  });

  it('going to the background backs up; other changes of state do not', async () => {
    leaving?.('active');
    leaving?.('inactive');
    expect(mockWrite).not.toHaveBeenCalled();
    leaving?.('background');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('the producer runs the opening check with the entitlement it is given', async () => {
    autoBackupLastAtPreference.set(0);
    await reconcile(entitlement('expired'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockWrite).not.toHaveBeenCalled();
    await reconcile(entitlement('lifetime'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});

describe('a fresh backup (a new folder or passphrase)', () => {
  it('does not reuse a run that began before; it writes again after it', async () => {
    let finishFirst: (value: WriteResult) => void = () => undefined;
    mockWrite.mockImplementationOnce(() => new Promise(resolve => (finishFirst = resolve)));
    const first = backUpNow();
    await new Promise(resolve => setTimeout(resolve, 0));
    const fresh = backUpNow(true);
    finishFirst(written);
    await expect(first).resolves.toBe('written');
    await expect(fresh).resolves.toBe('written');
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });
});
