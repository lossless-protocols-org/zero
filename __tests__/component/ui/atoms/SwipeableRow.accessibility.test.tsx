/**
 * M29 (v2.7.1): a row read as three fragments, and its edit/delete actions
 * sat on a view marked `accessible={false}` — unreachable from the VoiceOver
 * rotor. The row is now one element with a summary label and the actions.
 */
import React from 'react';
import {act, fireEvent, isHiddenFromAccessibility, screen} from '@testing-library/react-native';
import {Text} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SheetManager} from 'react-native-actions-sheet';
import {SwipeableRow} from '../../../../src/ui/atoms/SwipeableRow';
import {renderWithTheme, themeColors} from '../../../harness/render';
import {handlerOf} from '../../../harness/handlers';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
const mockSwipe = {enabled: true};
jest.mock('../../../../src/ui/hooks/usePreference', () => ({usePreference: () => mockSwipe.enabled}));

// The gesture/animation mocks schedule frames that must not fire into the next test.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const show = async () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  await renderWithTheme(
    <GestureHandlerRootView>
      <SwipeableRow
        onEdit={onEdit}
        onDelete={onDelete}
        colors={await themeColors()}
        accessibilityLabel="Lunch, ₹12, Food, 5 Oct">
        <Text>Lunch</Text>
        <Text>₹12</Text>
      </SwipeableRow>
    </GestureHandlerRootView>,
  );
  return {row: screen.getByLabelText('Lunch, ₹12, Food, 5 Oct'), onEdit, onDelete};
};

describe.each([true, false])('with swipe %s', swipe => {
  beforeEach(() => {
    mockSwipe.enabled = swipe;
  });

  it('is one element with the summary and both actions, which work', async () => {
    const {row, onEdit, onDelete} = await show();
    expect(row.props['accessible']).toBe(true);
    expect(row.props['accessibilityActions'].map((a: {name: string}) => a.name)).toEqual(['edit', 'delete']);
    await fireEvent(row, 'accessibilityAction', {nativeEvent: {actionName: 'delete'}});
    await fireEvent(row, 'accessibilityAction', {nativeEvent: {actionName: 'edit'}});
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

it('hides the swipe buttons from assistive tech: the row already carries their actions', async () => {
  mockSwipe.enabled = true;
  await show();
  const swipeButtons = ['common.edit', 'common.delete'].map(label =>
    screen.getByLabelText(label, {includeHiddenElements: true}),
  );
  for (const button of swipeButtons) {
    expect(isHiddenFromAccessibility(button)).toBe(true);
  }
  expect(screen.queryByLabelText('common.edit')).toBeNull();
});

it('draws the swipe action icons only once the row starts opening (2.7.1 gate: cold-scroll jank)', async () => {
  mockSwipe.enabled = true;
  await show();
  const drawnInside = (label: string) =>
    screen.getByLabelText(label, {includeHiddenElements: true}).queryAll(() => true).length;
  // Closed rows carry no icons: on Android each SVG icon is a bitmap upload on the first scroll.
  expect([drawnInside('common.edit'), drawnInside('common.delete')]).toEqual([0, 0]);
  // The drag is native (it cannot run under jest): call the handler the gesture library calls.
  const startDrag = handlerOf<['left' | 'right']>(screen.getByText('Lunch'), 'onSwipeableOpenStartDrag');
  await act(() => startDrag('left'));
  expect(drawnInside('common.edit')).toBeGreaterThan(0);
  expect(drawnInside('common.delete')).toBeGreaterThan(0);
});

describe.each([true, false])('long-press with swipe %s', swipe => {
  // A row with no extra actions (a refund row): the long-press must still open its menu.
  it('opens the edit/delete menu even with no extra actions', async () => {
    mockSwipe.enabled = swipe;
    const menu = jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
    await show();
    const onLongPress = handlerOf<[]>(screen.getByText('Lunch'), 'onLongPress');
    await act(() => onLongPress());
    expect(menu).toHaveBeenCalledWith('row-actions-sheet', expect.anything());
    menu.mockRestore();
  });
});
