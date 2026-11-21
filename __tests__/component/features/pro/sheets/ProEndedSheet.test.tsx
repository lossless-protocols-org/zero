/** Said once when Pro ends: what stopped, that nothing was lost, and two ways out. */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {ProEndedSheet} from '../../../../../src/features/pro/sheets/ProEndedSheet';
import {renderWithTheme} from '../../../../harness/render';
import {setStoredMonthStartDay} from '../../../../../src/pro/monthStart';
import {autoBackupLastAtPreference, autoBackupOnPreference} from '../../../../../src/platform/backupPreferences';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/atoms/CustomBottomSheet', () => require('../../../../harness/mocks/bottomSheet'));

beforeEach(() => {
  jest.spyOn(SheetManager, 'hide').mockResolvedValue(undefined);
  jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('says Pro has ended and that the data is kept', async () => {
  autoBackupOnPreference.set(false);
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  expect(screen.getByRole('header', {name: 'pro.endedTitle'})).toBeTruthy();
  expect(screen.getByText('pro.endedBody')).toBeTruthy();
  expect(screen.queryByText(/pro.endedAutoBackup/)).toBeNull();
});

it('OK closes it and opens nothing', async () => {
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  await fireEvent.press(screen.getByRole('button', {name: 'common.ok'}));
  expect(SheetManager.hide).toHaveBeenCalledWith('pro-ended-sheet');
  expect(SheetManager.show).not.toHaveBeenCalled();
});

it('Resume closes it, then opens the upgrade sheet', async () => {
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  await fireEvent.press(screen.getByRole('button', {name: 'pro.resume'}));
  expect(SheetManager.hide).toHaveBeenCalledWith('pro-ended-sheet');
  expect(SheetManager.show).toHaveBeenCalledWith('upgrade-sheet');
});

it('with automatic backup on and none made yet (P10): says it stopped too', async () => {
  autoBackupOnPreference.set(true);
  autoBackupLastAtPreference.set(0);
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  expect(screen.getByText('pro.endedAutoBackup')).toBeTruthy();
  autoBackupOnPreference.set(false);
});

it('with automatic backup on (P10): says it stopped, with the last one’s date', async () => {
  autoBackupOnPreference.set(true);
  autoBackupLastAtPreference.set(Date.UTC(2026, 10, 11, 16, 10));
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  expect(screen.getByText('pro.endedAutoBackupLast')).toBeTruthy();
  autoBackupOnPreference.set(false);
});

it('with a month start day chosen (P11): says months are calendar months again, and that the day is kept', async () => {
  setStoredMonthStartDay(7);
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  expect(screen.getByText('pro.endedMonthStart')).toBeTruthy();
  setStoredMonthStartDay(1);
});

it('without one, says nothing about months', async () => {
  setStoredMonthStartDay(1);
  await renderWithTheme(<ProEndedSheet sheetId="pro-ended-sheet" />);
  expect(screen.queryByText('pro.endedMonthStart')).toBeNull();
});
