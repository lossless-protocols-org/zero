/**
 * "Move to top" from further down the list: the list keeps its scroll offset
 * (it does not anchor on a row), so the moved category left the screen and
 * the move looked like it had done nothing (Moto, 2026-11-09). The list now
 * goes to the top, where the category went. FlashList is a stand-in: the
 * scroll and each row's move handler are what is checked.
 */
import React from 'react';
import {act} from '@testing-library/react-native';
import type {OrderMove} from '../../../../../src/domain/categoryOrder';
import {CategoryScreen} from '../../../../../src/features/categories/screens/CategoryScreen';
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
  mockScrollToOffset.mockClear();
  mockListProps.length = 0;
});

/** The move handler the screen gives a row, as a long-press menu item calls it. */
type RowElement = {props: {onMove: (kind: 'expense', id: string, move: OrderMove) => void}};
const moveFromRow = (): RowElement['props']['onMove'] => {
  const props = mockListProps.at(-1);
  const renderItem = props?.['renderItem'] as (info: {item: unknown; index: number}) => RowElement; // the screen's renderItem
  const item = {
    key: 'c1',
    category: {id: 'c1', name: 'Snacks', kind: 'expense', icon: 'circle', color: '#888888'},
    isFirst: false,
    isLast: true,
    canDelete: true,
  };
  return renderItem({item, index: 5}).props.onMove;
};

it('goes to the top of the list after "Move to top"', async () => {
  await renderInApp(<CategoryScreen />);
  await act(() => moveFromRow()('expense', 'c1', 'top'));
  expect(mockScrollToOffset).toHaveBeenCalledWith({offset: 0, animated: true});
});

it.each<OrderMove>(['up', 'down'])('stays where it is after "Move %s": the row stays in view', async move => {
  await renderInApp(<CategoryScreen />);
  await act(() => moveFromRow()('expense', 'c1', move));
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it('does not anchor on a row, so the order changes in place', async () => {
  await renderInApp(<CategoryScreen />);
  expect(mockListProps.at(-1)?.['maintainVisibleContentPosition']).toEqual({disabled: true});
});
