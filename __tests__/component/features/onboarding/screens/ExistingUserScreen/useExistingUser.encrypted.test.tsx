/**
 * Restoring an automatic backup (3.0, P10) from "I have a backup": the file
 * is recognised by its first bytes, nothing is touched until the passphrase
 * opens it, a wrong passphrase only says so, and the opened backup restores
 * exactly as a JSON one does. Never gated: this is onboarding, before any
 * store answer. Real LokiJS database and importer; the picker, the file
 * read and the native decrypt are stand-ins.
 */
import {act} from '@testing-library/react-native';
import RNFS from 'react-native-fs';
import {pick} from '@react-native-documents/picker';
import {database} from '../../../../../../src/data/database/database';
import {useExistingUser} from '../../../../../../src/features/onboarding/screens/ExistingUserScreen/useExistingUser';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../../../harness/mocks/dialogs';
import {renderHookInApp} from '../../../../../harness/render';
import {seedBackup} from '../../../../../harness/seed';

jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../../src/ui/context/DialogContext', () =>
  require('../../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../../src/platform/storagePermission', () => ({requestStoragePermission: async () => true}));
const mockDecrypt = jest.fn<Promise<string>, [string, string]>();
jest.mock('../../../../../../src/native/specs/NativeBackup', () => ({
  __esModule: true,
  default: {decrypt: (base64: string, passphrase: string) => mockDecrypt(base64, passphrase)},
}));

const BACKUP_JSON = JSON.stringify(seedBackup(25));

beforeEach(() => {
  resetDialogs();
  jest
    .mocked(pick)
    .mockResolvedValue([
      {uri: 'file:///b/zero-backup-2026-11-11.zbak', name: 'zero-backup-2026-11-11.zbak', size: 2048, error: null},
    ] as unknown as Awaited<ReturnType<typeof pick>>); // only the fields the hook reads
  jest.mocked(RNFS.readFile).mockImplementation(async (_path: string, encoding?: string) => {
    if (encoding !== 'base64') {
      throw new Error('Invalid continuation byte'); // what react-native-fs does with these bytes as text
    }
    return 'WkVST0JBSwEB';
  });
  mockDecrypt.mockReset().mockImplementation(async (_base64, passphrase) => {
    if (passphrase !== 'correct horse') {
      throw Object.assign(new Error('tag'), {code: 'wrongPassphrase'});
    }
    return BACKUP_JSON;
  });
});

const expenses = () => database.get('expenses').query().fetchCount();

it('asks for the passphrase and touches nothing until it opens the file', async () => {
  const {result} = await renderHookInApp(() => useExistingUser());
  await act(() => result.current.importData());
  expect(result.current.needsPassphrase).toBe(true);
  expect(result.current.uploadMessage).toBe('existingUser.enterPassphrase');
  expect(await expenses()).toBe(0);

  await act(() => result.current.unlock('wrong one'));
  expect(result.current.uploadMessage).toBe('existingUser.wrongPassphrase');
  expect(result.current.needsPassphrase).toBe(true);
  expect(await expenses()).toBe(0);
  expect(mockDecrypt).toHaveBeenLastCalledWith('WkVST0JBSwEB', 'wrong one');

  await act(() => result.current.unlock('correct horse'));
  expect(result.current.needsPassphrase).toBe(false);
  expect(result.current.isSyncComplete).toBe(true);
  expect(await expenses()).toBe(25);
});

it('a file made by a newer zero, or not a backup, is said as for a JSON file', async () => {
  const {result} = await renderHookInApp(() => useExistingUser());
  await act(() => result.current.importData());
  mockDecrypt.mockRejectedValueOnce(Object.assign(new Error('v2'), {code: 'newerFormat'}));
  await act(() => result.current.unlock('correct horse'));
  expect(result.current.uploadMessage).toBe('existingUser.newerVersion');
  mockDecrypt.mockResolvedValueOnce('not json');
  await act(() => result.current.unlock('correct horse'));
  expect(result.current.uploadMessage).toBe('existingUser.invalidJson');
});

it('choosing another file puts this one down', async () => {
  const {result} = await renderHookInApp(() => useExistingUser());
  await act(() => result.current.importData());
  await act(async () => result.current.cancelUnlock());
  expect(result.current.needsPassphrase).toBe(false);
  expect(result.current.uploadMessage).toBe('existingUser.uploadFile');
  await act(() => result.current.unlock('correct horse'));
  expect(mockDecrypt).not.toHaveBeenCalled();
});

it('two taps on "Open backup" open and restore once', async () => {
  const {result} = await renderHookInApp(() => useExistingUser());
  await act(() => result.current.importData());
  await act(async () => {
    await Promise.all([result.current.unlock('correct horse'), result.current.unlock('correct horse')]);
  });
  expect(mockDecrypt).toHaveBeenCalledTimes(1);
  expect(await expenses()).toBe(25);
});

it('when data is already here and the user keeps it, nothing is touched and the line is reset', async () => {
  const {seedAccounts} =
    require('../../../../../harness/accountsSeed') as typeof import('../../../../../harness/accountsSeed');
  await seedAccounts();
  const before = await expenses();
  answerNextDialog(false);
  const {result} = await renderHookInApp(() => useExistingUser());
  await act(() => result.current.importData());
  await act(() => result.current.unlock('correct horse'));
  expect(dialogsSaid()).toEqual(['warning: existingUser.replaceDataWarning']);
  expect(result.current.uploadMessage).toBe('existingUser.uploadFile');
  expect(await expenses()).toBe(before);
});
