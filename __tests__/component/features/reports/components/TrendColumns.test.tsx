/**
 * The Trends chart (redesign): each column is as tall as the money that came
 * in, spent from the bottom and kept on top with a gap between; a month that
 * spent more than came in gets a cap; the month still running is paler; the
 * selected column is outlined and says so; a dashed line marks the usual.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {TREND_CHART_HEIGHT, TrendColumns} from '../../../../../src/features/reports/components/TrendColumns';
import {renderWithTheme, themeColors} from '../../../../harness/render';

const column = (key: string, spent: number, kept: number, over = 0) => ({
  key,
  label: key,
  spoken: `month ${key}`,
  spent,
  kept,
  over,
});
const COLUMNS = [column('a', 0.5, 0.25), column('b', 0.6, 0, 0.2), column('c', 0.1, 0), column('d', 0, 0)];
const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props['style']);

const show = (onSelect = jest.fn(), usual: number | null = 0.5) =>
  renderWithTheme(<TrendColumns columns={COLUMNS} selectedKey="a" runningKey="c" usual={usual} onSelect={onSelect} />);

it('spent stands at the bottom and kept on it, 2 apart, in the shares given', async () => {
  const colors = await themeColors();
  await show();
  expect(styleOf('trend-spent-a')).toMatchObject({
    height: 0.5 * TREND_CHART_HEIGHT,
    backgroundColor: colors.secondaryText,
  });
  // The gap is taken out of the part above, so the column stays as tall as the money in.
  expect(styleOf('trend-kept-a')).toMatchObject({
    height: 0.25 * TREND_CHART_HEIGHT - 2,
    marginBottom: 2,
    backgroundColor: colors.accentGreen,
  });
  expect(screen.queryByTestId('trend-over-a')).toBeNull();
  // Kept comes before spent in the column: it is drawn above it.
  const parts = screen
    .getByTestId('trend-column-a')
    .children.map(child => (typeof child === 'string' ? child : child.props['testID']));
  expect(parts).toEqual(['trend-kept-a', 'trend-spent-a']);
});

it('a month that spent more than came in has a red cap and no kept part', async () => {
  const colors = await themeColors();
  await show();
  expect(styleOf('trend-over-b')).toMatchObject({
    height: 0.2 * TREND_CHART_HEIGHT - 2,
    marginBottom: 2,
    backgroundColor: colors.accentRed,
  });
  expect(styleOf('trend-spent-b').height).toBe(0.6 * TREND_CHART_HEIGHT);
  expect(screen.queryByTestId('trend-kept-b')).toBeNull();
});

it('a month of spending alone is one part, and an empty month none', async () => {
  await show();
  expect(styleOf('trend-spent-c').height).toBe(0.1 * TREND_CHART_HEIGHT);
  expect(screen.queryByTestId('trend-kept-c')).toBeNull();
  expect(screen.getByTestId('trend-column-d').children).toHaveLength(0);
});

it('the month still running is paler; the selected one is outlined and says it is selected', async () => {
  const colors = await themeColors();
  await show();
  expect(styleOf('trend-column-c').opacity).toBe(0.55);
  expect(styleOf('trend-column-a').opacity).toBeUndefined();
  expect(styleOf('trend-column-a').borderColor).toBe(colors.primaryText);
  expect(styleOf('trend-column-b').borderColor).toBe('transparent');
  expect(screen.getByRole('button', {name: 'month a'}).props['accessibilityState']).toEqual({selected: true});
  expect(screen.getByRole('button', {name: 'month b'}).props['accessibilityState']).toEqual({selected: false});
});

it('tapping a column selects it', async () => {
  const onSelect = jest.fn();
  await show(onSelect);
  await fireEvent.press(screen.getByRole('button', {name: 'month b'}));
  expect(onSelect).toHaveBeenCalledWith('b');
});

it('the dashed line sits at the usual spending, and is left out when there is none', async () => {
  const view = await show();
  // 3 is the outline's room under every column.
  expect(styleOf('trend-usual-line').bottom).toBe(3 + 0.5 * TREND_CHART_HEIGHT);
  await view.unmount();
  await show(jest.fn(), null);
  expect(screen.queryByTestId('trend-usual-line')).toBeNull();
});
