/**
 * M12 (v2.7.1): Home and Reports each drew their own ‹ month › pill. One atom
 * now; the forward chevron must swallow its tap when there is no next month
 * (a disabled touchable lets the tap fall through and open the picker).
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {MonthNavigator} from '../../../../src/ui/atoms/MonthNavigator';
import {renderWithTheme} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

const show = async (props: Partial<React.ComponentProps<typeof MonthNavigator>> = {}) => {
  const onShift = jest.fn();
  const onOpenPicker = jest.fn();
  await renderWithTheme(
    <MonthNavigator label="October 2026" canGoForward onShift={onShift} onOpenPicker={onOpenPicker} {...props} />,
  );
  return {onShift, onOpenPicker};
};

describe('MonthNavigator', () => {
  it('compact shows the short month but still reads the full one', async () => {
    await show({compact: true, shortLabel: 'Oct 2026'});
    expect(screen.getByText('Oct 2026')).toBeOnTheScreen();
    expect(screen.queryByText('October 2026')).toBeNull();
    expect(screen.getByLabelText('October 2026')).toBeOnTheScreen();
  });

  it('the full-size navigator keeps the full label', async () => {
    await show({shortLabel: 'Oct 2026'});
    expect(screen.getByText('October 2026')).toBeOnTheScreen();
  });

  it('steps back and forward a month', async () => {
    const {onShift} = await show();
    await fireEvent.press(screen.getByLabelText('home.previousMonth'));
    await fireEvent.press(screen.getByLabelText('home.nextMonth'));
    expect(onShift.mock.calls).toEqual([[-1], [1]]);
  });

  it('swallows the forward tap when there is no next month', async () => {
    const {onShift, onOpenPicker} = await show({canGoForward: false});
    await fireEvent.press(screen.getByLabelText('home.nextMonthUnavailable'));
    expect(onShift).not.toHaveBeenCalled();
    expect(onOpenPicker).not.toHaveBeenCalled();
  });

  it('opens the picker from the label when asked to', async () => {
    const {onOpenPicker} = await show();
    await fireEvent.press(screen.getByLabelText('October 2026'));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });
});
