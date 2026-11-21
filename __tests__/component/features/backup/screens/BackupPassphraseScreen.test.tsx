/**
 * A new passphrase for the automatic backup (P10): typed twice, then today's
 * backup is written again with it and the screen closes. A failure changes
 * nothing and says so.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {BackupPassphraseScreen} from '../../../../../src/features/backup/screens/BackupPassphraseScreen';
import {goBack} from '../../../../../src/platform/navigationUtils';
import {backUpNow} from '../../../../../src/pro/autoBackup';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {renderInApp} from '../../../../harness/render';

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
  folder: jest.fn(async () => '{"state":"ok","volume":"phone","path":"Documents/zero","files":1}'),
  setPassphrase: jest.fn<Promise<void>, [string]>(),
};
jest.mock('../../../../../src/native/specs/NativeBackup', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const type = async (first: string, second: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('autoBackup.passphraseLabel'), first);
  await fireEvent.changeText(screen.getByPlaceholderText('autoBackup.passphraseAgainLabel'), second);
};

beforeEach(() => {
  resetDialogs();
  jest.mocked(backUpNow).mockClear();
  jest.mocked(goBack).mockClear();
  mockNative.setPassphrase.mockReset().mockResolvedValue(undefined);
});

it('is typed twice, then today’s backup is written again with it', async () => {
  await renderInApp(<BackupPassphraseScreen />);
  await settle();
  expect(screen.getByText('autoBackup.changePassphraseHint')).toBeTruthy();
  expect(screen.getByRole('button', {name: 'autoBackup.save'})).toBeDisabled();
  await type('another long one', 'another long one');
  await fireEvent.press(screen.getByText('autoBackup.save'));
  await settle();
  expect(mockNative.setPassphrase).toHaveBeenCalledWith('another long one');
  expect(backUpNow).toHaveBeenCalledTimes(1);
  expect(goBack).toHaveBeenCalled();
});

it('a passphrase the phone could not keep is said, and the screen stays', async () => {
  mockNative.setPassphrase.mockRejectedValue(new Error('Keystore'));
  await renderInApp(<BackupPassphraseScreen />);
  await settle();
  await type('another long one', 'another long one');
  await fireEvent.press(screen.getByText('autoBackup.save'));
  await settle();
  expect(dialogsSaid()).toEqual(['error: autoBackup.failedSetup']);
  expect(backUpNow).not.toHaveBeenCalled();
  expect(goBack).not.toHaveBeenCalled();
});
