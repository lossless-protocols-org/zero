/**
 * The month start picker (3.0 Pro, P11): every day a month is sure to have
 * (1 to 28), the month it would make shown before applying, and Apply hands
 * back the picked day.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {MonthStartPickerSheet} from '../../../../../src/features/settings/sheets/MonthStartPickerSheet';
import {periodFor, periodKeyOf} from '../../../../../src/domain/period';
import {formatMonthLabel} from '../../../../../src/platform/dateFormat';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderWithTheme} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/atoms/CustomBottomSheet', () => require('../../../../harness/mocks/bottomSheet'));

beforeEach(() => {
  jest.spyOn(SheetManager, 'hide').mockResolvedValue(undefined);
  setMockTranslations({'settings.monthStartDay': 'Day {{day}}', 'settings.monthStartPreview': 'This month: {{month}}'});
});
afterEach(() => {
  jest.restoreAllMocks();
  setMockTranslations({});
});

const open = (current: number | undefined, onSelect = jest.fn()) =>
  renderWithTheme(<MonthStartPickerSheet sheetId="month-start-picker-sheet" payload={{current, onSelect}} />).then(
    () => onSelect,
  );
const monthWith = (day: number) => formatMonthLabel(periodFor(periodKeyOf(new Date(), day), day));

it('offers days 1 to 28 and marks the current one', async () => {
  await open(7);
  const days = screen.getAllByRole('radio');
  expect(days).toHaveLength(28);
  expect(screen.getByRole('radio', {name: 'Day 7'}).props['accessibilityState']).toEqual({checked: true});
  expect(screen.queryByRole('radio', {name: 'Day 29'})).toBeNull();
  expect(screen.getByText(`This month: ${monthWith(7)}`)).toBeTruthy();
});

it('shows the month a picked day would make, then hands the day back on Apply', async () => {
  const onSelect = await open(1);
  await fireEvent.press(screen.getByRole('radio', {name: 'Day 15'}));
  expect(screen.getByText(`This month: ${monthWith(15)}`)).toBeTruthy();
  expect(onSelect).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', {name: 'settings.monthStartApply'}));
  expect(onSelect).toHaveBeenCalledWith(15);
  expect(SheetManager.hide).toHaveBeenCalledWith('month-start-picker-sheet');
});

it('a current value that is not a day starts on the 1st; closing changes nothing', async () => {
  const onSelect = await open(31);
  expect(screen.getByRole('radio', {name: 'Day 1'}).props['accessibilityState']).toEqual({checked: true});
  await fireEvent.press(screen.getByRole('button', {name: 'close-sheet'}));
  expect(onSelect).not.toHaveBeenCalled();
});
