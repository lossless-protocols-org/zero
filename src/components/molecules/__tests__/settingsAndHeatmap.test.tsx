/**
 * M13 (v2.7.1): pieces split out of SettingsScreen and ReportsScreen.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle} from 'react-native';

const mockNavigate = jest.fn();
jest.mock('../../../utils/navigationUtils', () => ({navigate: (...args: unknown[]) => mockNavigate(...args)}));
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../../hooks/useThemeColors', () => ({
  __esModule: true,
  default: () => ({
    accentGreen: '#00aa00',
    secondaryAccent: '#eeeeee',
    containerColor: '#ffffff',
    secondaryContainerColor: '#dddddd',
    buttonText: '#000000',
    primaryText: '#111111',
    secondaryText: '#777777',
  }),
}));

jest.mock('../../../hooks/useFormatAmount', () => ({__esModule: true, default: () => (n: number) => `₹${n}`}));

// required after jest.mock so the mocks apply; each cast names the module's own type
const {SettingsSection} = require('../SettingsSection') as typeof import('../SettingsSection');
const {MonthCalendarHeatmap} = require('../MonthCalendarHeatmap') as typeof import('../MonthCalendarHeatmap');

const render = async (element: React.ReactElement) => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer!; // created in act above
};

it('SettingsSection draws a divider between rows, none before the first or after the last', async () => {
  const renderer = await render(
    <SettingsSection title="Data">
      <Text>a</Text>
      <Text>b</Text>
      <Text>c</Text>
    </SettingsSection>,
  );
  const dividers = renderer.root.findAll(
    node => typeof node.type === 'string' && JSON.stringify(node.props['style'] ?? '').includes('"height":1'),
  );
  expect(dividers).toHaveLength(2);
});

describe('MonthCalendarHeatmap', () => {
  // October 2026 starts on a Thursday.
  const props = {year: 2026, monthIndex: 9, daysInMonth: 31, dayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S']};
  const days = (renderer: ReactTestRenderer.ReactTestRenderer) => renderer.root.findAllByType(TouchableOpacity);

  it('leads with blanks for the week start, then one cell per day', async () => {
    const sunday = await render(<MonthCalendarHeatmap {...props} transactions={[]} weekStart="sunday" />);
    const monday = await render(<MonthCalendarHeatmap {...props} transactions={[]} weekStart="monday" />);
    const blanks = (r: ReactTestRenderer.ReactTestRenderer) =>
      r.root.findAll(node => typeof node.type === 'string' && node.props['testID'] === 'calendar-blank').length;
    expect(blanks(sunday)).toBe(4);
    expect(blanks(monday)).toBe(3);
    expect(days(sunday)).toHaveLength(31);
  });

  it('lays the month out as full weeks of seven equal columns, on any width', async () => {
    const weeksOf = (r: ReactTestRenderer.ReactTestRenderer) =>
      r.root.findAll(node => typeof node.type === 'string' && node.props['testID'] === 'calendar-week');
    const sunday = await render(<MonthCalendarHeatmap {...props} transactions={[]} weekStart="sunday" />);
    const monday = await render(<MonthCalendarHeatmap {...props} transactions={[]} weekStart="monday" />);
    // 4 + 31 = 35 cells: five full weeks. 3 + 31 = 34: five weeks, the last padded.
    expect(weeksOf(sunday)).toHaveLength(5);
    expect(weeksOf(monday)).toHaveLength(5);
    for (const week of [...weeksOf(sunday), ...weeksOf(monday)]) {
      expect(week.children).toHaveLength(7);
    }
    // Same border on every cell: Yoga counts it in a flex item's minimum basis,
    // so borderless blanks made the first week's columns 3.7 pt off the rest
    // (measured on an iPhone 16).
    const borderOf = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>)?.borderWidth ?? 0; // style prop of a host View
    for (const week of weeksOf(monday)) {
      expect(
        new Set(week.children.map(cell => (typeof cell === 'string' ? -1 : borderOf(cell.props['style'])))),
      ).toEqual(new Set([1]));
    }
    // Weekday names grow at most 1.3×: at the largest text they ran together ("SunMonTue").
    const headers = sunday.root.findAll(
      node => typeof node.type !== 'string' && ['S', 'M', 'T', 'W', 'F'].includes(node.props['children']),
    );
    expect(headers.length).toBeGreaterThanOrEqual(7);
    expect(headers.every(h => h.props['maxFontSizeMultiplier'] === 1.3)).toBe(true);
    // No percentage widths: columns share the row, so 7 always fill it exactly.
    const styleText = JSON.stringify(sunday.toJSON());
    expect(styleText).not.toMatch(/"width":"[\d.]+%"/);
  });

  it('each day is a button a screen reader names by date, with the spend when there is one', async () => {
    const renderer = await render(
      <MonthCalendarHeatmap {...props} transactions={[{date: '2026-10-05T10:00:00', amount: 12}]} weekStart="sunday" />,
    );
    const cells = days(renderer);
    expect(cells.every(cell => cell.props['accessibilityRole'] === 'button')).toBe(true);
    const fifth = cells[4]?.props['accessibilityLabel'];
    const sixth = cells[5]?.props['accessibilityLabel'];
    expect(fifth).toMatch(/5/);
    expect(fifth).toContain('2026');
    expect(fifth).toContain('₹12');
    expect(sixth).toMatch(/6/);
    expect(sixth).not.toContain('₹');
  });

  it('days are drawn 36 pt tall but stay 44 pt to touch (the grid had grown to 44 pt rows)', async () => {
    const renderer = await render(<MonthCalendarHeatmap {...props} transactions={[]} weekStart="sunday" />);
    for (const cell of days(renderer)) {
      const style = StyleSheet.flatten(cell.props['style'] as StyleProp<ViewStyle>); // a touchable's style prop
      const slop = cell.props['hitSlop'] as {top: number; bottom: number};
      expect(style?.height).toBe(36);
      expect(style?.minHeight).toBeUndefined();
      expect(36 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    }
  });

  it('opens the tapped day', async () => {
    const renderer = await render(
      <MonthCalendarHeatmap {...props} transactions={[{date: '2026-10-05T10:00:00', amount: 12}]} weekStart="sunday" />,
    );
    days(renderer)[4]?.props['onPress']();
    expect(mockNavigate).toHaveBeenCalledWith('EverydayTransactionScreen', {isDate: '2026-10-05'});
  });
});
