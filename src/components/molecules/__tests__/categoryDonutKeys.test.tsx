/**
 * M32 review (v2.7.1): the Reports donut grouped expenses by the name it
 * shows. Once seeded names are translated, a seeded "Food" shown as "Comida"
 * and a category the user typed as "Comida" merged into one slice — summed,
 * and tapping it opened only one of them. Slices are keyed by category id.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../../../utils/navigationUtils', () => ({navigate: jest.fn()}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => (key === 'defaultCategories.food' ? 'Comida' : key)}),
}));
jest.mock('../../../hooks/useThemeColors', () => ({__esModule: true, default: () => ({secondaryText: '#777777'})}));
jest.mock('../../../hooks/useFormatAmount', () => ({__esModule: true, default: () => (n: number) => String(n)}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const {CategoryDonut} = require('../CategoryDonut') as typeof import('../CategoryDonut');

type Transactions = React.ComponentProps<typeof CategoryDonut>['transactions'];

it('keeps a translated seed name and a same-named user category apart', async () => {
  // Only the fields the donut reads; the cast stands in for the full row type.
  const transactions = [
    {id: 'e1', amount: 10, category: {id: 'seed', name: 'Food', color: '#111111', icon: 'utensils-crossed'}},
    {id: 'e2', amount: 5, category: {id: 'mine', name: 'Comida', color: '#222222', icon: 'pizza'}},
    {id: 'e3', amount: 2, category: {id: 'seed', name: 'Food', color: '#111111', icon: 'utensils-crossed'}},
  ] as unknown as Transactions;
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CategoryDonut transactions={transactions} categoryBudgets={{}} yearMonth="2026-10" />,
    );
  });
  // The legend (PieChartLabels) is the element handed every slice, hidden or not.
  const slices = renderer?.root.find(node => Array.isArray(node.props['slices'])).props['slices'];
  expect(slices.map((s: {key: string; label: string; value: number}) => [s.key, s.label, s.value])).toEqual([
    ['seed', 'Comida', 12],
    ['mine', 'Comida', 5],
  ]);
});
