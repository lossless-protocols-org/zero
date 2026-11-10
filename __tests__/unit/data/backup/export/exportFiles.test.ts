/**
 * L2 (v2.7.1): the CSV export used to fall back to the Redux snapshot taken
 * when Settings gained focus (`(await getAllData()) ?? allData`), so a failed
 * database read silently exported stale data and reported success. A failed
 * read must report failure and write nothing. Export logic lives in
 * exportFiles.ts so it can be exercised without rendering the screen.
 *
 * Tickets: M2.
 */
import {Platform, Share} from 'react-native';
import RNFS from 'react-native-fs';
import * as errorLog from '../../../../../src/platform/errorLog';
import type {ExportDraft} from '../../../../../src/data/backup/export/format';
import {exportCsv, exportJson, type ExportDeps} from '../../../../../src/data/backup/export/exportFiles';

const writeFile = jest.mocked(RNFS.writeFile);
const unlink = jest.mocked(RNFS.unlink);

const sample: ExportDraft = {
  users: [{username: 'Ada', email: ''}],
  categories: [{name: 'Fuel', kind: 'expense', categoryStatus: true, icon: 'car', color: '#111111'}],
  expenses: [{title: 'Petrol', amount: 40, description: '', category: {name: 'Fuel'}, date: '2026-08-01T10:00:00'}],
  currencies: [{code: 'INR', symbol: '₹', name: 'Indian Rupee'}],
  debtors: [],
  debts: [],
  budgets: [],
  accounts: [],
  incomes: [],
};

const makeDeps = (
  data: ExportDraft | null,
  permission = true,
): ExportDeps & {calls: boolean[]; details: string[]; dialogs: number} => {
  const deps = {
    calls: [] as boolean[],
    details: [] as string[],
    dialogs: 0,
    getAllData: async () => data,
    handleExportResult: async (success: boolean, detail?: string) => {
      deps.calls.push(success);
      if (detail) {
        deps.details.push(detail);
      }
    },
    requestStoragePermission: async () => permission,
    requestStorageViaDialog: async () => {
      deps.dialogs++;
    },
    shareTitle: 'Export Zero Data',
    noUserMessage: 'No user profile was found, so there is nothing to back up.',
    invalidRowMessage: (detail: string) => `Export stopped: ${detail}.`,
  };
  return deps;
};

beforeEach(() => {
  writeFile.mockClear();
  unlink.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Android path: straight to Downloads, no share sheet. */
const onAndroid = (): void => {
  jest.replaceProperty(Platform, 'OS', 'android');
};

/** iOS path: the share sheet decides the outcome. */
const onIos = (action: 'sharedAction' | 'dismissedAction'): jest.SpyInstance => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  return jest.spyOn(Share, 'share').mockResolvedValue({action: Share[action], activityType: undefined});
};

describe('exportCsv', () => {
  it('reports failure and writes nothing when the database read fails', async () => {
    const deps = makeDeps(null);
    await expect(exportCsv(deps)).resolves.toBe('failed');
    expect(deps.calls).toEqual([false]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes the CSV of the data read NOW into Downloads on Android', async () => {
    onAndroid();
    const deps = makeDeps(sample);
    await expect(exportCsv(deps)).resolves.toBe('saved');
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/downloads\/zero_expenses_\d{14}\.csv$/),
      expect.stringContaining('Petrol'),
      'utf8',
    );
    expect(deps.calls).toEqual([true]);
  });

  it('a denied storage permission on Android shows the permission dialog, writes nothing and fails', async () => {
    onAndroid();
    const deps = makeDeps(sample, false);
    await expect(exportCsv(deps)).resolves.toBe('failed');
    expect(deps.dialogs).toBe(1);
    expect(deps.calls).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('a failed write is logged, reported and returned as failed', async () => {
    onAndroid();
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    writeFile.mockRejectedValueOnce(new Error('ENOSPC'));
    const deps = makeDeps(sample);
    await expect(exportCsv(deps)).resolves.toBe('failed');
    expect(log).toHaveBeenCalledTimes(1);
    expect(deps.calls).toEqual([false]);
  });

  it('a throw while serialising is also logged, reported and returned as failed', async () => {
    onAndroid();
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    // A malformed row: the CSV builder dereferences category.name.
    const broken = {...sample, expenses: [{...sample.expenses[0], category: undefined}]} as unknown as ExportDraft; // deliberately invalid shape for this test
    const deps = makeDeps(broken);
    await expect(exportCsv(deps)).resolves.toBe('failed');
    expect(log).toHaveBeenCalledTimes(1);
    expect(deps.calls).toEqual([false]);
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe('exportJson', () => {
  it('reports failure and writes nothing when the database read fails', async () => {
    const deps = makeDeps(null);
    await expect(exportJson(deps)).resolves.toBe('failed');
    expect(deps.calls).toEqual([false]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses to export without a user row, with its own message', async () => {
    onAndroid();
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    const deps = makeDeps({...sample, users: []});
    await expect(exportJson(deps)).resolves.toBe('failed');
    expect(writeFile).not.toHaveBeenCalled();
    expect(deps.calls).toEqual([false]);
    expect(deps.details).toEqual(['No user profile was found, so there is nothing to back up.']);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('refuses to write a backup that would not restore, and says so', async () => {
    onAndroid();
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    const corrupt: ExportDraft = {...sample, expenses: [{...sample.expenses[0]!, amount: -1}]}; // sample has one expense
    const deps = makeDeps(corrupt);
    await expect(exportJson(deps)).resolves.toBe('failed');
    expect(writeFile).not.toHaveBeenCalled();
    expect(deps.calls).toEqual([false]);
    // The user is told which entry, not just that it failed.
    expect(deps.details).toEqual([
      'Export stopped: expenses row 1 ("Petrol", 2026-08-01T10:00:00), amount: must not be negative.',
    ]);
    expect(String(log.mock.calls[0]?.[0])).toContain('expenses row 1');
  });

  it('on iOS a dismissed share sheet means no backup was saved', async () => {
    onIos('dismissedAction');
    const deps = makeDeps(sample);
    await expect(exportJson(deps)).resolves.toBe('cancelled');
    expect(deps.calls).toEqual([]);
  });

  // iOS (🧭 first half, v2.7.1): the file is staged in the temporary directory and
  // removed once the share sheet is done, so backups no longer pile up inside the
  // app's Documents folder (which iCloud/Finder back up).
  it('on iOS a completed share is a saved export, staged in the temporary directory and unlinked afterwards', async () => {
    const share = onIos('sharedAction');
    const deps = makeDeps(sample);
    await expect(exportJson(deps)).resolves.toBe('saved');
    expect(deps.calls).toEqual([true]);
    expect(share).toHaveBeenCalledTimes(1);
    const path = writeFile.mock.calls[0]?.[0];
    expect(path).toMatch(/^\/tmp\/temporary\/zero_v5_\d{14}\.json$/); // single slash despite the trailing-slash constant
    expect(share).toHaveBeenCalledWith({url: `file://${path}`, title: 'Export Zero Data'});
    expect(unlink).toHaveBeenCalledWith(path);
  });

  it('on iOS the staged file is unlinked only after the share sheet has settled', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    let settle: (value: {action: 'sharedAction'; activityType: string | undefined}) => void = () => {};
    jest.spyOn(Share, 'share').mockReturnValue(
      new Promise(resolve => {
        settle = resolve;
      }),
    );
    const pending = exportJson(makeDeps(sample));
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(unlink).not.toHaveBeenCalled();
    settle({action: 'sharedAction', activityType: undefined});
    await expect(pending).resolves.toBe('saved');
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('on iOS a failed write does not try to unlink a file that was never written', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    writeFile.mockRejectedValueOnce(new Error('ENOSPC'));
    await expect(exportJson(makeDeps(sample))).resolves.toBe('failed');
    expect(unlink).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain('ENOSPC');
  });

  it('on iOS a dismissed share still unlinks the staged file', async () => {
    onIos('dismissedAction');
    await expect(exportJson(makeDeps(sample))).resolves.toBe('cancelled');
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('on iOS a share sheet that throws is logged, reported, failed — and the staged file is still unlinked', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no share extension'));
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    const deps = makeDeps(sample);
    await expect(exportJson(deps)).resolves.toBe('failed');
    expect(log).toHaveBeenCalledTimes(1);
    expect(deps.calls).toEqual([false]);
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('on iOS a failed unlink does not turn a saved export into a failure, but is logged', async () => {
    onIos('sharedAction');
    unlink.mockRejectedValueOnce(new Error('EBUSY'));
    const log = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    const deps = makeDeps(sample);
    await expect(exportJson(deps)).resolves.toBe('saved');
    expect(deps.calls).toEqual([true]);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
