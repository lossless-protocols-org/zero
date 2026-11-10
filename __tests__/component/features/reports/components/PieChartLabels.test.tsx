/**
 * The category list under Reports' donut. A row opens its category, and its
 * eye hides it from the chart. Both say what they are to a screen reader
 * (audit 2026-11-08 §9: the row was a touchable with no role, read as
 * fragments), and the eye is a 44 dp target though drawn at 15.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {PieChartLabels} from '../../../../../src/features/reports/components/PieChartLabels';
import {renderWithTheme, themeColors} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));

const slices = [
  {key: 'c1', label: 'Food', value: 300, color: '#111111', categoryId: 'c1', categoryIcon: 'pizza'},
  {key: 'c2', label: 'Fuel', value: 100, color: '#222222', categoryId: 'c2', categoryIcon: 'fuel'},
];

const show = async (extra: Partial<React.ComponentProps<typeof PieChartLabels>> = {}) => {
  const onCategoryPress = jest.fn();
  const onToggleExclude = jest.fn();
  await renderWithTheme(
    <PieChartLabels
      colors={await themeColors()}
      slices={slices}
      onCategoryPress={onCategoryPress}
      onToggleExclude={onToggleExclude}
      {...extra}
    />,
  );
  return {onCategoryPress, onToggleExclude};
};

it('a row is a button that opens its category, biggest first', async () => {
  const {onCategoryPress} = await show();
  const rows = screen.getAllByRole('button').filter(b => b.props['accessibilityHint'] === 'reports.openCategoryHint');
  expect(rows).toHaveLength(2);
  await fireEvent.press(rows[0]!); // two rows found above
  expect(onCategoryPress).toHaveBeenCalledWith('c1');
});

it('the eye hides and shows its category, and is 44 dp to touch', async () => {
  const {onToggleExclude} = await show({excludedKeys: new Set(['c2'])});
  const hide = screen.getByLabelText('reports.hideCategory');
  const show2 = screen.getByLabelText('reports.showCategory');
  await fireEvent.press(hide);
  await fireEvent.press(show2);
  expect(onToggleExclude.mock.calls).toEqual([['c1'], ['c2']]);
  const slop = hide.props['hitSlop'] as {top: number; bottom: number}; // the toggle passes an edge object
  expect(15 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
});

it('without a handler, a row is not a button', async () => {
  await show({onCategoryPress: undefined, onToggleExclude: undefined});
  expect(screen.queryAllByRole('button')).toEqual([]);
  expect(screen.getByText('Food')).toBeOnTheScreen();
});

it('a row says its figures and offers hide as an action: VoiceOver reaches nothing inside it', async () => {
  // Found on the iPhone (2026-11-09): the eye inside the row could not be reached by VoiceOver.
  const {onToggleExclude} = await show();
  const food = screen.getAllByRole('button').find(b => b.props['accessibilityHint'] === 'reports.openCategoryHint');
  expect(food?.props['accessibilityLabel']).toBe('Food, ₹300, 75%');
  expect(food?.props['accessibilityActions']).toEqual([{name: 'toggle', label: 'reports.hideCategory'}]);
  await fireEvent(food!, 'accessibilityAction', {nativeEvent: {actionName: 'toggle'}}); // found above
  expect(onToggleExclude).toHaveBeenCalledWith('c1');
});
