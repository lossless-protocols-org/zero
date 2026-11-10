/**
 * M32 review (v2.7.1): the Reports donut grouped expenses by the name it
 * shows. Once seeded names are translated, a seeded "Food" shown as "Comida"
 * and a category the user typed as "Comida" merged into one slice — summed,
 * and tapping it opened only one of them. Slices are keyed by category id.
 *
 * Tickets: R2.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {CategoryDonut} from '../../../../../src/features/reports/components/CategoryDonut';
import {renderWithTheme} from '../../../../harness/render';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';

jest.mock('../../../../../src/platform/navigationUtils', () => ({navigate: jest.fn()}));
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
// Amounts as plain numbers, so the legend reads `name · amount · share`.
jest.mock('../../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => String(n)}));

type Transactions = React.ComponentProps<typeof CategoryDonut>['transactions'];

/** Every text on screen, in order: the legend draws name, amount and share per slice. */
const texts = () => screen.container.queryAll(node => node.type === 'Text').map(node => node.children.join(''));

beforeAll(() => setMockTranslations({'defaultCategories.food': 'Comida'}));

it('keeps a translated seed name and a same-named user category apart', async () => {
  // Only the fields the donut reads; the cast stands in for the full row type.
  const transactions = [
    {id: 'e1', amount: 10, category: {id: 'seed', name: 'Food', color: '#111111', icon: 'utensils-crossed'}},
    {id: 'e2', amount: 5, category: {id: 'mine', name: 'Comida', color: '#222222', icon: 'pizza'}},
    {id: 'e3', amount: 2, category: {id: 'seed', name: 'Food', color: '#111111', icon: 'utensils-crossed'}},
  ] as unknown as Transactions;
  await renderWithTheme(<CategoryDonut transactions={transactions} categoryBudgets={{}} yearMonth="2026-10" />);
  expect(texts()).toEqual(['Comida', '12', '71%', 'Comida', '5', '29%']);
});

it('nets refunds per category: a category refunded past its spending gets no wedge and a "back" line', async () => {
  // Signed spend rows: refunds are negative under their expense's category.
  const transactions: Transactions = [
    {amount: 3000, category: {id: 'shop', name: 'Shopping', color: '#333333', icon: 'bag'}},
    {amount: -1200, category: {id: 'shop', name: 'Shopping', color: '#333333', icon: 'bag'}},
    {amount: 0.1, category: {id: 'food', name: 'Food', color: '#111111', icon: 'pizza'}},
    {amount: 0.2, category: {id: 'food', name: 'Food', color: '#111111', icon: 'pizza'}},
    {amount: -500, category: {id: 'coat', name: 'Coats', color: '#444444', icon: 'shirt'}},
  ];
  await renderWithTheme(<CategoryDonut transactions={transactions} categoryBudgets={{}} yearMonth="2026-11" />);
  // Two wedges: Shopping nets to 1800 and the food cents add up exactly (no
  // 0.30000000000000004); Coats, refunded past its spending, is only a "back" line.
  // Seeded names show through their copy keys (Food has a translation set above).
  expect(texts()).toEqual([
    'defaultCategories.shopping',
    '1800',
    '100%',
    'Comida',
    '0.3',
    '0%',
    'reports.categoryBack',
  ]);
});
