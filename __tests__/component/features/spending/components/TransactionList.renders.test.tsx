/**
 * A refetch that brings back the same rows re-renders none of them (audit
 * 2026-11-08 §8.3). Every Home focus refetches the month, and the rows come
 * back as new objects; with the default memo every mounted row re-rendered
 * each time. A row that did change still re-renders.
 *
 * Rows are counted at SwipeableRow, the one child every row renders.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {TransactionList} from '../../../../../src/features/spending/components/TransactionList';
import type {ExpenseWithCategory} from '../../../../../src/domain/types';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const renders: string[] = [];
jest.mock('../../../../../src/ui/atoms/SwipeableRow', () => {
  const actual = jest.requireActual<typeof import('../../../../../src/ui/atoms/SwipeableRow')>(
    '../../../../../src/ui/atoms/SwipeableRow',
  );
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    SwipeableRow: (props: React.ComponentProps<typeof actual.SwipeableRow>) => {
      renders.push(props.rowKey ?? '?');
      return ReactActual.createElement(actual.SwipeableRow, props);
    },
  };
});

const food = {id: 'c1', name: 'Food', icon: 'pizza', color: '#112233'};
const month = (): ExpenseWithCategory[] => [
  {
    id: 'e1',
    title: 'Lunch',
    amount: 120,
    description: '',
    categoryId: 'c1',
    userId: 'u1',
    date: '2026-11-03T13:00:00',
    category: {...food},
  },
  {
    id: 'e2',
    title: 'Tea',
    amount: 20,
    description: '',
    categoryId: 'c1',
    userId: 'u1',
    date: '2026-11-04T09:00:00',
    category: {...food},
  },
];

const list = (expenses: ExpenseWithCategory[], refundedByExpense: Record<string, number> = {}) => (
  <TransactionList allExpenses={expenses} refundedByExpense={refundedByExpense} targetMonth="2026-11" />
);

beforeEach(() => {
  renders.length = 0;
  // The gesture/animation mocks schedule frames that must not fire into the next test.
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('draws every row once', async () => {
  await renderInApp(list(month()));
  expect(screen.getByText('Lunch')).toBeTruthy();
  expect(renders.sort()).toEqual(['e1', 'e2']);
});

it('a refetch of the same rows, as new objects, re-renders no row', async () => {
  const view = await renderInApp(list(month()));
  renders.length = 0;
  await view.rerender(list(month(), {}));
  expect(renders).toEqual([]);
});

it('re-renders only the row that changed', async () => {
  const view = await renderInApp(list(month()));
  renders.length = 0;
  const [lunch, tea] = month();
  await view.rerender(list([{...lunch!, title: 'Late lunch'}, tea!])); // month() always has two rows
  expect(renders).toEqual(['e1']);
  expect(screen.getByText('Late lunch')).toBeTruthy();
});

it('re-renders a row whose refund badge changed', async () => {
  const view = await renderInApp(list(month()));
  renders.length = 0;
  await view.rerender(list(month(), {e2: 5}));
  expect(renders).toEqual(['e2']);
});
