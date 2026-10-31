/**
 * Found on the iPhone 16 at the largest text size (2.7.1 iOS pass): the
 * "~₹39,744/day · ₹39,744 left today" line was a row of three texts that
 * cannot wrap, so it ran off the card ("…left tod"). It is one paragraph now.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, View} from 'react-native';
import type {TFunction} from 'i18next';
import type {ThemeColors} from '../../../hooks/useThemeColors';
jest.mock('../../../hooks/useThemeColors', () => ({__esModule: true, default: () => ({primaryText: '#111'})}));

// required after jest.mock so the mock applies; the cast names the module's own type
const DailyBudgetRow = (require('../DailyBudgetRow') as typeof import('../DailyBudgetRow')).default;

// The row reads only these three tokens.
const colors = {secondaryText: '#777', accentGreen: '#0a0', accentOrange: '#a60'} as unknown as ThemeColors;
// The row only calls t(key); this stands in for i18next's overloaded TFunction.
const t = ((key: string) => key) as unknown as TFunction;

it('is one wrapping paragraph, not a row of separate texts', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DailyBudgetRow
        dailyBudget={39744}
        dailyLeft={39744}
        isCurrentMonth
        colors={colors}
        formatAmount={n => `₹${n}`}
        t={t}
      />,
    );
  });
  const root = renderer?.toJSON();
  // The outermost host element is a Text (so its children flow and wrap), not a View row.
  expect(Array.isArray(root) ? undefined : root?.type).toBe('Text');
  const text = JSON.stringify(root);
  expect(text).toContain('₹39744');
  expect(text).toContain('home.leftToday');
  expect(renderer?.root.findAllByType(View)).toHaveLength(0);
  expect(renderer?.root.findAllByType(Text).length).toBeGreaterThan(0);
});
