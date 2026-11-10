/**
 * M13 (v2.7.1): the Reports month calendar, split out of ReportsScreen: one
 * cell per day after the week-start blanks, full weeks of seven equal
 * columns, and days a screen reader names by date (with the spend).
 */
import React from 'react';
import {fireEvent} from '@testing-library/react-native';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {MonthCalendarHeatmap} from '../../../../../src/features/reports/components/MonthCalendarHeatmap';
import {renderWithTheme} from '../../../../harness/render';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';

const mockNavigate = jest.fn();
jest.mock('../../../../../src/platform/navigationUtils', () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
beforeAll(() => setMockTranslations({'common.fieldValue': '{{field}}, {{value}}'}));
jest.mock('../../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));

// October 2026 starts on a Thursday.
const props = {year: 2026, monthIndex: 9, daysInMonth: 31, dayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S']};
type WeekStart = 'sunday' | 'monday';
const show = (weekStart: WeekStart, transactions: Array<{date: string; amount: number}> = []) =>
  renderWithTheme(<MonthCalendarHeatmap {...props} transactions={transactions} weekStart={weekStart} />);
const byTestId = (view: Awaited<ReturnType<typeof show>>, id: string) =>
  view.container.queryAll(node => node.props['testID'] === id);
const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}; // a host View's style prop

it('leads with blanks for the week start, then one cell per day', async () => {
  const sunday = await show('sunday');
  const monday = await show('monday');
  expect(byTestId(sunday, 'calendar-blank')).toHaveLength(4);
  expect(byTestId(monday, 'calendar-blank')).toHaveLength(3);
  expect(sunday.getAllByRole('button')).toHaveLength(31);
});

it('lays the month out as full weeks of seven equal columns, on any width', async () => {
  const sunday = await show('sunday');
  const monday = await show('monday');
  // 4 + 31 = 35 cells: five full weeks. 3 + 31 = 34: five weeks, the last padded.
  expect(byTestId(sunday, 'calendar-week')).toHaveLength(5);
  expect(byTestId(monday, 'calendar-week')).toHaveLength(5);
  for (const week of [...byTestId(sunday, 'calendar-week'), ...byTestId(monday, 'calendar-week')]) {
    expect(week.children).toHaveLength(7);
  }
  // Same border on every cell: Yoga counts it in a flex item's minimum basis,
  // so borderless blanks made the first week's columns 3.7 pt off the rest
  // (measured on an iPhone 16).
  for (const week of byTestId(monday, 'calendar-week')) {
    const borders = week.children.map(cell =>
      typeof cell === 'string' ? -1 : (flat(cell.props['style']).borderWidth ?? 0),
    );
    expect(new Set(borders)).toEqual(new Set([1]));
  }
  // Weekday names grow at most 1.3×: at the largest text they ran together ("SunMonTue").
  const headers = sunday.container.queryAll(
    node => node.type === 'Text' && ['S', 'M', 'T', 'W', 'F'].includes(node.children.join('')),
  );
  expect(headers).toHaveLength(7);
  expect(headers.every(h => h.props['maxFontSizeMultiplier'] === 1.3)).toBe(true);
  // No percentage widths: columns share the row, so 7 always fill it exactly.
  expect(JSON.stringify(sunday.toJSON())).not.toMatch(/"width":"[\d.]+%"/);
});

it('each day is a button a screen reader names by date, with the spend when there is one', async () => {
  const view = await show('sunday', [{date: '2026-10-05T10:00:00', amount: 12}]);
  const cells = view.getAllByRole('button');
  const fifth = cells[4]?.props['accessibilityLabel'];
  const sixth = cells[5]?.props['accessibilityLabel'];
  expect(fifth).toMatch(/5/);
  expect(fifth).toContain('2026');
  expect(fifth).toContain('₹12');
  expect(sixth).toMatch(/6/);
  expect(sixth).not.toContain('₹');
});

it('days are drawn 36 pt tall but stay 44 pt to touch (the grid had grown to 44 pt rows)', async () => {
  const view = await show('sunday');
  for (const cell of view.getAllByRole('button')) {
    const style = flat(cell.props['style']);
    const slop = cell.props['hitSlop'] as {top: number; bottom: number}; // the cell passes an edge object
    expect(style.height).toBe(36);
    expect(style.minHeight).toBeUndefined();
    expect(36 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  }
});

it('opens the tapped day', async () => {
  const view = await show('sunday', [{date: '2026-10-05T10:00:00', amount: 12}]);
  const fifth = view.getAllByRole('button')[4];
  if (!fifth) {
    throw new Error('no fifth day');
  }
  await fireEvent.press(fifth);
  expect(mockNavigate).toHaveBeenCalledWith('EverydayTransactionScreen', {isDate: '2026-10-05'});
});
