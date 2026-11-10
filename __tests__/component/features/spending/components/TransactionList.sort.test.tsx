/**
 * A new sort starts at the top of the list. FlashList keeps its anchor row in
 * view when the data changes, so a re-sort used to land wherever that row now
 * sat, often the end of the month (found on the Moto and the iPhone,
 * 2026-11-09). On the Moto that anchoring ran after the scroll and undid it,
 * so the list does not anchor at all. FlashList is a stand-in here: the
 * scroll and the props it is given are what is checked.
 */
import React from 'react';
import {act} from '@testing-library/react-native';
import {TransactionList} from '../../../../../src/features/spending/components/TransactionList';
import {listSortPreference} from '../../../../../src/features/spending/listSort';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const mockScrollToOffset = jest.fn();
const mockListProps: Array<Record<string, unknown>> = [];
jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    FlashList: ReactActual.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      mockListProps.push(props);
      ReactActual.useImperativeHandle(ref, () => ({scrollToOffset: mockScrollToOffset}));
      return null;
    }),
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  mockScrollToOffset.mockClear();
  mockListProps.length = 0;
  listSortPreference.set('date');
});
afterEach(() => jest.useRealTimers());

const list = <TransactionList allExpenses={[]} targetMonth="2026-11" sortable />;

it('does not scroll when it first draws', async () => {
  await renderInApp(list);
  await act(() => jest.runOnlyPendingTimers());
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it('scrolls to the top when the sort changes', async () => {
  await renderInApp(list);
  await act(() => listSortPreference.set('amount'));
  await act(() => jest.runOnlyPendingTimers());
  expect(mockScrollToOffset).toHaveBeenCalledWith({offset: 0, animated: false});
});

it('does not anchor on a row, which on Android undid the scroll to the top', async () => {
  await renderInApp(list);
  expect(mockListProps.at(-1)?.['maintainVisibleContentPosition']).toEqual({disabled: true});
});

/** Two November expenses, enough for the sort chip to show. */
const expenses = [
  {id: 'e1', title: 'Chai', amount: 20, description: '', categoryId: 'food', userId: 'u1', date: '2026-11-04T09:00:00'},
  {id: 'e2', title: 'Bus', amount: 30, description: '', categoryId: 'bus', userId: 'u1', date: '2026-11-05T09:00:00'},
];

/** The sort chip FlashList was handed as part of its header. */
const sortChip = (): React.ReactElement<{spaced?: boolean}> | undefined => {
  // TransactionList hands FlashList a fragment element: the screen's header, then the chip.
  const header = mockListProps.at(-1)?.['ListHeaderComponent'] as
    React.ReactElement<{children: React.ReactNode}> | undefined;
  return React.Children.toArray(header?.props.children).find(
    (child): child is React.ReactElement<{spaced?: boolean}> =>
      React.isValidElement(child) && (child.type as {name?: string}).name === 'SortChip', // element types here are function components
  );
};

it.each([
  ['title', true],
  ['amount', true],
  ['date', false],
  ['category', false],
] as const)(
  'sort by %s: the chip keeps a gap above the first row only when no heading gives one (%s)',
  async (sort, spaced) => {
    listSortPreference.set(sort);
    await renderInApp(<TransactionList allExpenses={expenses} targetMonth="2026-11" sortable />);
    expect(sortChip()?.props.spaced).toBe(spaced);
  },
);
