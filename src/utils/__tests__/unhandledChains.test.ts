/**
 * M7 (v2.7.1): the remaining fire-and-forget chains. A thrown permission
 * request read as "denied" with nothing recorded; unhandled promise
 * rejections were logged non-fatal, so the next-launch crash prompt never
 * asked about them. Each now reaches the error log, rejections carry an
 * `unhandled` flag the prompt honours, and `logRejection` is the one helper
 * for promises nobody awaits.
 */
import {PermissionsAndroid, Platform} from 'react-native';
import * as errorLog from '../errorLog';
import {
  getUnreportedFatal,
  logRejection,
  markRejectionHandled,
  recordUnhandledRejection,
  type ErrorLogEntry,
} from '../errorLog';
import {requestStoragePermission} from '../dataUtils';
import StorageService from '../storage';

beforeEach(() => {
  StorageService.removeItemSync('error_log');
});
afterEach(() => {
  jest.restoreAllMocks();
});

const entry = (overrides: Partial<ErrorLogEntry>): ErrorLogEntry => ({
  timestamp: '2026-10-26T10:00:00.000Z',
  message: 'x',
  stack: '',
  fatal: false,
  ...overrides,
});

describe('unhandled rejections (M7)', () => {
  it('are recorded with the unhandled flag', () => {
    recordUnhandledRejection('plain string reason');
    const [logged] = errorLog.getErrorLog();
    expect(logged?.message).toBe('Unhandled promise rejection: plain string reason');
    expect(logged?.unhandled).toBe(true);
    expect(logged?.fatal).toBe(false);
  });

  it('a rejection handled after the tracker fired keeps its entry but is not asked about', () => {
    const stamp = recordUnhandledRejection(new Error('late'));
    markRejectionHandled(stamp);
    const entries = errorLog.getErrorLog();
    expect(entries).toHaveLength(1);
    expect(getUnreportedFatal(entries, null)).toBeNull();
  });

  it('a dialog rejected because its provider unmounted is never logged as the unhandled cause', async () => {
    const {DialogUnmountedError} =
      require('../../context/DialogContext') as typeof import('../../context/DialogContext'); // require: keeps react-native out of the module graph until here
    recordUnhandledRejection(new DialogUnmountedError());
    logRejection(Promise.reject(new DialogUnmountedError()));
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    expect(errorLog.getErrorLog()).toEqual([]);
  });

  it('a non-Error reason keeps its content', () => {
    recordUnhandledRejection({code: 'E_PICKER', reason: 'cancelled'});
    expect(errorLog.getErrorLog()[0]?.message).toBe(
      'Unhandled promise rejection: {"code":"E_PICKER","reason":"cancelled"}',
    );
  });

  it('the next-launch prompt asks about an unhandled rejection, not only about fatals', () => {
    const entries = [
      entry({timestamp: '2026-10-26T10:00:00.000Z'}),
      entry({timestamp: '2026-10-26T11:00:00.000Z', unhandled: true}),
    ];
    expect(getUnreportedFatal(entries, null)?.timestamp).toBe('2026-10-26T11:00:00.000Z');
    expect(getUnreportedFatal(entries, '2026-10-26T11:00:00.000Z')).toBeNull();
    expect(getUnreportedFatal([entry({})], null)).toBeNull();
  });
});

describe('logRejection (M7)', () => {
  // logRejection calls appendErrorLog inside the same module, so the stored log is what is checked.
  it('writes a rejected promise to the error log', async () => {
    logRejection(Promise.reject(new Error('share sheet missing')));
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    const entries = errorLog.getErrorLog();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe('share sheet missing');
    // Nothing handled it: the next launch asks about it.
    expect(getUnreportedFatal(entries, null)?.message).toBe('share sheet missing');
  });

  it('does nothing for a resolved promise', async () => {
    logRejection(Promise.resolve('ok'));
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    expect(errorLog.getErrorLog()).toEqual([]);
  });
});

describe('requestStoragePermission (M7)', () => {
  it('a thrown request is logged, not silently read as "denied"', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockRejectedValue(new Error('activity is null'));
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    await expect(requestStoragePermission()).resolves.toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('activity is null');
  });
});
