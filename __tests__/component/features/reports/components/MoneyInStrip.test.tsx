/**
 * Reports' Money-in card (round two, item 2): one bar the size of what came
 * in, split into spent and kept; spending past it is a red end, said in words.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {MoneyInStrip} from '../../../../../src/features/reports/components/MoneyInStrip';
import {renderInApp, themeColors} from '../../../../harness/render';
import type {ThemeColors} from '../../../../../src/ui/hooks/useThemeColors';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

let lightColors: ThemeColors;
beforeAll(async () => {
  lightColors = await themeColors();
});

const widthOf = (testID: string): unknown =>
  StyleSheet.flatten(screen.getByTestId(testID, {includeHiddenElements: true}).props['style']).width;

it('splits what came in into spent and kept, as shares of one bar', async () => {
  await renderInApp(<MoneyInStrip colors={lightColors} received={90_000} spent={27_000} refunded={0} />);
  expect(widthOf('money-in-spent')).toBe('30%');
  expect(widthOf('money-in-end')).toBe('70%');
  expect(screen.getByText('reports.kept')).toBeTruthy();
  expect(screen.getByText(/63,000/)).toBeTruthy();
  expect(screen.queryByText('reports.overCameIn')).toBeNull();
});

it('spending past what came in is a red end on the bar, named in words', async () => {
  await renderInApp(<MoneyInStrip colors={lightColors} received={90_000} spent={120_000} refunded={0} />);
  // The bar is as long as the spending: three quarters of it is what came in, the rest is over.
  expect(widthOf('money-in-spent')).toBe('75%');
  expect(widthOf('money-in-end')).toBe('25%');
  expect(
    StyleSheet.flatten(screen.getByTestId('money-in-end', {includeHiddenElements: true}).props['style'])
      .backgroundColor,
  ).toBe(lightColors.accentRed);
  expect(screen.getByText('reports.overCameIn')).toBeTruthy();
  expect(screen.getByText(/30,000/)).toBeTruthy();
  expect(screen.queryByText('reports.kept')).toBeNull();
});

it('with no money in there is no bar to split', async () => {
  await renderInApp(<MoneyInStrip colors={lightColors} received={0} spent={0} refunded={500} />);
  expect(screen.queryByTestId('money-in-bar')).toBeNull();
});
