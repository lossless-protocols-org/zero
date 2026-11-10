/**
 * Found on the iPhone 16 at the largest text size (2.7.1 iOS pass): the
 * "~₹39,744/day · ₹39,744 left today" line was a row of three texts that
 * cannot wrap, so it ran off the card ("…left tod"). It is one paragraph now.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {DailyBudgetRow} from '../../../../src/ui/atoms/DailyBudgetRow';
import {renderWithTheme} from '../../../harness/render';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';

// The currency comes from the session; this atom only needs a formatter.
jest.mock('../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));
jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

beforeAll(() => {
  setMockTranslations({'home.perDayAmount': '~{{amount}}/day', 'home.amountLeftToday': '{{amount}} left today'});
});

it('is one wrapping paragraph, not a row of separate texts', async () => {
  await renderWithTheme(<DailyBudgetRow dailyBudget={39744} dailyLeft={39744} isCurrentMonth />);
  const tree = screen.toJSON();
  // The outermost host element is a Text (so its children flow and wrap), not a View row.
  expect(tree && !Array.isArray(tree) ? tree.type : undefined).toBe('Text');
  expect(screen.getByText(/~₹39744\/day/)).toBeOnTheScreen();
  expect(screen.getByText('₹39744 left today')).toBeOnTheScreen();
  expect(screen.container.queryAll(node => node.type === 'View')).toEqual([]);
});
