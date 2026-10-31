/**
 * M29 (v2.7.1): a row read as three fragments, and its edit/delete actions
 * sat on a view marked `accessible={false}` — unreachable from the VoiceOver
 * rotor. The row is now one element with a summary label and the actions.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
const mockSwipe = {enabled: true};
jest.mock('../../../hooks/usePreference', () => ({usePreference: () => mockSwipe.enabled}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const SwipeableRow = (require('../SwipeableRow') as typeof import('../SwipeableRow')).default;

const colors = {accentGreen: '#0a0', accentOrange: '#a60', lightAccent: '#eee'};

// The gesture/animation mocks schedule frames that must not fire into the next test.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const render = async () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <GestureHandlerRootView>
        <SwipeableRow onEdit={onEdit} onDelete={onDelete} colors={colors} accessibilityLabel="Lunch, ₹12, Food, 5 Oct">
          <Text>Lunch</Text>
          <Text>₹12</Text>
        </SwipeableRow>
      </GestureHandlerRootView>,
    );
  });
  const row = renderer!.root.find(
    node => typeof node.type === 'string' && node.props['accessibilityActions'] !== undefined,
  ); // created in act above
  return {row, root: renderer!.root, onEdit, onDelete}; // created in act above
};

describe.each([true, false])('with swipe %s', swipe => {
  beforeEach(() => {
    mockSwipe.enabled = swipe;
  });

  it('is one element with the summary and both actions, which work', async () => {
    const {row, onEdit, onDelete} = await render();
    expect(row.props['accessible']).toBe(true);
    expect(row.props['accessibilityLabel']).toBe('Lunch, ₹12, Food, 5 Oct');
    expect(row.props['accessibilityActions'].map((a: {name: string}) => a.name)).toEqual(['edit', 'delete']);
    row.props['onAccessibilityAction']({nativeEvent: {actionName: 'delete'}});
    row.props['onAccessibilityAction']({nativeEvent: {actionName: 'edit'}});
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

it('hides the swipe buttons from assistive tech: the row already carries their actions', async () => {
  mockSwipe.enabled = true;
  const {root} = await render();
  const swipeButtons = root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props['accessibilityRole'] === 'button' &&
      ['common.edit', 'common.delete'].includes(node.props['accessibilityLabel']),
  );
  expect(swipeButtons.length).toBeGreaterThan(0);
  for (const button of swipeButtons) {
    expect(button.props['importantForAccessibility']).toBe('no-hide-descendants');
    expect(button.props['accessibilityElementsHidden']).toBe(true);
  }
});

it('draws the swipe action icons only once the row starts opening (2.7.1 gate: cold-scroll jank)', async () => {
  mockSwipe.enabled = true;
  const {root} = await render();
  const icons = () => root.findAll(node => ['pencil', 'trash-2'].includes(node.props['name']));
  // Closed rows carry no icons: on Android each SVG icon is a bitmap upload on the first scroll.
  expect(icons()).toHaveLength(0);
  const swipeable = root.find(node => typeof node.props['onSwipeableOpenStartDrag'] === 'function');
  await ReactTestRenderer.act(() => {
    swipeable.props['onSwipeableOpenStartDrag']('left');
  });
  expect(
    icons()
      .map(node => node.props['name'])
      .sort(),
  ).toEqual(['pencil', 'trash-2']);
});
