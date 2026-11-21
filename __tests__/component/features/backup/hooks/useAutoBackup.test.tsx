/**
 * The automatic backup's actions (P10), alone: one at a time, a folder read
 * that fails is logged and shows no folder, a folder chosen while off makes
 * no backup, and turning off clears what Settings shows.
 */
import {act} from '@testing-library/react-native';
import {useAutoBackup} from '../../../../../src/features/backup/hooks/useAutoBackup';
import {
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../../../../../src/platform/backupPreferences';
import * as errorLog from '../../../../../src/platform/errorLog';
import {backUpNow} from '../../../../../src/pro/autoBackup';
import {resetDialogs} from '../../../../harness/mocks/dialogs';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));
jest.mock('../../../../../src/pro/autoBackup', () => ({backUpNow: jest.fn(async () => 'written')}));
const mockNative = {
  chooseFolder: jest.fn(async () => '{"outcome":"chosen"}'),
  folder: jest.fn<Promise<string>, []>(),
  forget: jest.fn(async () => undefined),
};
jest.mock('../../../../../src/native/specs/NativeBackup', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

beforeEach(() => {
  resetDialogs();
  jest.mocked(backUpNow).mockClear();
  mockNative.folder.mockReset().mockResolvedValue('{"state":"ok","volume":"phone","path":"zero","files":0}');
  autoBackupOnPreference.set(false);
});

it('a folder that cannot be read is logged, and shows as none', async () => {
  const logged = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
  mockNative.folder.mockRejectedValue(new Error('provider gone'));
  const {result} = await renderHookInApp(() => useAutoBackup());
  await settle();
  expect(result.current.folder).toEqual({state: 'none'});
  expect(logged).toHaveBeenCalled();
  logged.mockRestore();
});

it('choosing a folder while off makes no backup; one action at a time', async () => {
  const {result} = await renderHookInApp(() => useAutoBackup());
  await settle();
  await act(async () => {
    await Promise.all([result.current.chooseFolder(), result.current.chooseFolder()]);
  });
  expect(mockNative.chooseFolder).toHaveBeenCalledTimes(1);
  expect(backUpNow).not.toHaveBeenCalled();
  expect(result.current.busy).toBe('none');
});

it('turning off clears what Settings shows', async () => {
  autoBackupOnPreference.set(true);
  autoBackupLastAtPreference.set(123);
  autoBackupStatusPreference.set('failed');
  const {result} = await renderHookInApp(() => useAutoBackup());
  await settle();
  await act(() => result.current.turnOff());
  expect(mockNative.forget).toHaveBeenCalled();
  expect(autoBackupOnPreference.get()).toBe(false);
  expect(autoBackupLastAtPreference.get()).toBe(0);
  expect(autoBackupStatusPreference.get()).toBe('none');
});
