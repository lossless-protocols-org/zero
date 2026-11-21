/**
 * A1 (3.0): the gap between a swiped row and its edit/delete circle was 21 on
 * Home and Debts and 5 on Categories, because edge-to-edge lists added the 16
 * side margin twice (on the row and on the action slot). There is now one slot
 * (a 40 circle and an 8 gap) and the side margin belongs to the swipe container.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {StyleSheet, Text} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SWIPE_ACTION_SLOT_WIDTH} from '../../../../src/ui/atoms/SwipeAction';
import {SwipeableRow} from '../../../../src/ui/atoms/SwipeableRow';
import {renderWithTheme, themeColors} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/ui/hooks/usePreference', () => ({usePreference: () => true}));

// The gesture/animation mocks schedule frames that must not fire into the next test.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const slotStyles = async (edgeToEdge: boolean) => {
  await renderWithTheme(
    <GestureHandlerRootView>
      <SwipeableRow onEdit={jest.fn()} onDelete={jest.fn()} colors={await themeColors()} edgeToEdge={edgeToEdge}>
        <Text>Lunch</Text>
      </SwipeableRow>
    </GestureHandlerRootView>,
  );
  const [edit, remove] = ['common.edit', 'common.delete'].map(label =>
    StyleSheet.flatten(screen.getByLabelText(label, {includeHiddenElements: true}).props['style']),
  );
  return {edit, remove};
};

it('pins the slot: a 40 circle and an 8 gap', () => {
  expect(SWIPE_ACTION_SLOT_WIDTH).toBe(48);
});

it.each([true, false])('gives both actions the same slot, gap towards the row (edgeToEdge %s)', async edgeToEdge => {
  const {edit, remove} = await slotStyles(edgeToEdge);
  // No padding on the outer side: the circle's outer edge sits on the row's resting edge.
  expect(edit).toMatchObject({width: 48, paddingRight: 8});
  expect(edit).not.toHaveProperty('paddingLeft');
  expect(remove).toMatchObject({width: 48, paddingLeft: 8});
  expect(remove).not.toHaveProperty('paddingRight');
});

const marginsAbove = (label: string) => {
  const margins: unknown[] = [];
  for (let node = screen.getByText(label).parent; node; node = node.parent) {
    margins.push(StyleSheet.flatten(node.props['style'])?.marginHorizontal);
  }
  return margins.filter(margin => margin !== undefined);
};

it('puts the 16 side margin of an edge-to-edge list on the swipe container, once', async () => {
  await slotStyles(true);
  expect(marginsAbove('Lunch')).toEqual([16]);
});

it('adds no side margin on a padded screen', async () => {
  await slotStyles(false);
  expect(marginsAbove('Lunch')).toEqual([]);
});
