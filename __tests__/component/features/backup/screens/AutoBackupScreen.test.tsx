/**
 * Automatic backup (3.0 Pro, P10). Off: a folder, then a passphrase typed
 * twice, then a first backup at once. On: when the last one was made, what
 * needs the user (a lost folder), the days kept, a new passphrase, turning
 * off (the files stay). The native module is a stand-in; the vault, MMKV and
 * the dialogs' wording are real.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AutoBackupScreen} from '../../../../../src/features/backup/screens/AutoBackupScreen';
import {
  autoBackupKeepPreference,
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../../../../../src/platform/backupPreferences';
import {goBack, navigate} from '../../../../../src/platform/navigationUtils';
import {backUpNow} from '../../../../../src/pro/autoBackup';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {renderInApp} from '../../../../harness/render';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';

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
  chooseFolder: jest.fn<Promise<string>, []>(),
  folder: jest.fn<Promise<string>, []>(),
  setPassphrase: jest.fn<Promise<void>, [string]>(),
  forget: jest.fn<Promise<void>, []>(),
};
jest.mock('../../../../../src/native/specs/NativeBackup', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));
const native = mockNative;

const OK_FOLDER = '{"state":"ok","volume":"phone","path":"Documents/zero backups","files":2}';
const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<AutoBackupScreen />);
  await settle();
};
const typePassphrases = async (first: string, second: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('autoBackup.passphraseLabel'), first);
  await fireEvent.changeText(screen.getByPlaceholderText('autoBackup.passphraseAgainLabel'), second);
};

beforeEach(() => {
  resetDialogs();
  jest.mocked(backUpNow).mockClear();
  jest.mocked(navigate).mockClear();
  jest.mocked(goBack).mockClear();
  native.chooseFolder.mockReset().mockResolvedValue('{"outcome":"chosen"}');
  native.folder.mockReset().mockResolvedValue('{"state":"none"}');
  native.setPassphrase.mockReset().mockResolvedValue(undefined);
  native.forget.mockReset().mockResolvedValue(undefined);
  autoBackupOnPreference.set(false);
  autoBackupLastAtPreference.set(0);
  autoBackupStatusPreference.set('none');
  autoBackupKeepPreference.set('14');
});

describe('turning it on', () => {
  it('needs a folder and a passphrase typed twice, then makes the first backup at once', async () => {
    await show();
    expect(screen.getByText('autoBackup.intro')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'autoBackup.turnOn'})).toBeDisabled();

    native.folder.mockResolvedValue(OK_FOLDER);
    await fireEvent.press(screen.getByText('autoBackup.chooseFolder'));
    await settle();
    expect(screen.getByText('autoBackup.volumePhone · Documents/zero backups')).toBeTruthy();
    expect(screen.getByText('autoBackup.changeFolder')).toBeTruthy();

    await typePassphrases('short', 'short');
    expect(screen.getByText('autoBackup.passphraseTooShort')).toBeTruthy();
    await typePassphrases('long enough one', 'long enough two');
    expect(screen.getByText('autoBackup.passphraseMismatch')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'autoBackup.turnOn'})).toBeDisabled();

    await typePassphrases('long enough one', 'long enough one');
    // The passphrase cannot be recovered: it turns on only once the user says it is written down.
    expect(screen.getByRole('button', {name: 'autoBackup.turnOn'})).toBeDisabled();
    expect(screen.getByText('autoBackup.needWritten')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', {name: 'autoBackup.writtenDown'}));
    await fireEvent.press(screen.getByText('autoBackup.turnOn'));
    await settle();
    expect(native.setPassphrase).toHaveBeenCalledWith('long enough one');
    expect(autoBackupOnPreference.get()).toBe(true);
    expect(backUpNow).toHaveBeenCalledTimes(1);
    // On now: the screen shows the backup, not the setup.
    expect(screen.getByText('autoBackup.settings')).toBeTruthy();
  });

  it('a folder that is not on the phone is refused, and said', async () => {
    native.chooseFolder.mockResolvedValue('{"outcome":"notOnDevice"}');
    await show();
    await fireEvent.press(screen.getByText('autoBackup.chooseFolder'));
    await settle();
    expect(dialogsSaid()).toEqual(['info: autoBackup.notOnDevice']);
    expect(screen.getByRole('button', {name: 'autoBackup.turnOn'})).toBeDisabled();
  });

  it('a passphrase the phone could not keep changes nothing, and is said', async () => {
    native.folder.mockResolvedValue(OK_FOLDER);
    native.setPassphrase.mockRejectedValue(new Error('Keychain'));
    await show();
    await typePassphrases('long enough one', 'long enough one');
    await fireEvent.press(screen.getByRole('checkbox', {name: 'autoBackup.writtenDown'}));
    await fireEvent.press(screen.getByText('autoBackup.turnOn'));
    await settle();
    expect(dialogsSaid()).toEqual(['error: autoBackup.failedSetup']);
    expect(autoBackupOnPreference.get()).toBe(false);
    expect(backUpNow).not.toHaveBeenCalled();
  });
});

describe('when on', () => {
  beforeEach(() => {
    autoBackupOnPreference.set(true);
    native.folder.mockResolvedValue(OK_FOLDER);
  });

  it('shows the last backup and the files in the folder; "Back up now" makes one', async () => {
    await show();
    expect(screen.getByText('autoBackup.never')).toBeTruthy();
    expect(screen.getByText('autoBackup.filesCount')).toBeTruthy();
    await fireEvent.press(screen.getByText('autoBackup.backUpNow'));
    await settle();
    expect(backUpNow).toHaveBeenCalledTimes(1);
    autoBackupLastAtPreference.set(Date.UTC(2026, 10, 11, 16, 10));
    await settle();
    expect(screen.queryByText('autoBackup.never')).toBeNull();
  });

  it('says what needs the user: a lost folder, a missing key, a failed write', async () => {
    native.folder.mockResolvedValue('{"state":"lost","volume":"phone","path":"Documents/zero backups"}');
    await show();
    expect(screen.getByText('autoBackup.statusFolderLost')).toBeTruthy();
    native.folder.mockResolvedValue(OK_FOLDER);
    // The fix sits with the problem.
    await fireEvent.press(screen.getByText('autoBackup.chooseAgain'));
    await settle();
    // A folder chosen again while on: backed up there at once.
    expect(backUpNow).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('autoBackup.statusFolderLost')).toBeNull();
    await act(() => autoBackupStatusPreference.set('noKey'));
    expect(screen.getByText('autoBackup.statusNoKey')).toBeTruthy();
    await act(() => autoBackupStatusPreference.set('failed'));
    expect(screen.getByText('autoBackup.statusFailed')).toBeTruthy();
  });

  it('keeps the days chosen', async () => {
    setMockTranslations({'autoBackup.keepDays': '{{count}} days'});
    await show();
    expect(screen.getByText('14 days')).toBeTruthy();
    await fireEvent.press(screen.getByText('30 days'));
    expect(autoBackupKeepPreference.get()).toBe('30');
    setMockTranslations({});
  });

  it('opens the new-passphrase screen', async () => {
    await show();
    await fireEvent.press(screen.getByText('autoBackup.passphraseRow'));
    expect(navigate).toHaveBeenCalledWith('BackupPassphraseScreen');
  });

  it('turning off asks first, forgets the folder and key, and keeps the files', async () => {
    await show();
    answerNextDialog(false);
    await fireEvent.press(screen.getByText('autoBackup.turnOff'));
    await settle();
    expect(autoBackupOnPreference.get()).toBe(true);
    expect(native.forget).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('autoBackup.turnOff'));
    await settle();
    expect(dialogsSaid()).toEqual(['warning: autoBackup.turnOffConfirm', 'warning: autoBackup.turnOffConfirm']);
    expect(native.forget).toHaveBeenCalledTimes(1);
    expect(autoBackupOnPreference.get()).toBe(false);
  });
});
