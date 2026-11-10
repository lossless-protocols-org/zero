/**
 * The body of a form screen (2.8): exactly the screen's height in portrait
 * (the layout as it always was), growing and scrolling in landscape, and on
 * Android making room for the keyboard it draws over the window. Before this
 * suite it had 3 of 39 lines covered (audit 2026-11-08 §7.6).
 */
import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {FormScroll} from '../../../../src/ui/atoms/FormScroll';

// The window FormScroll measures itself against; each test sets its orientation.
const mockWindow = {width: 360, height: 800, scale: 3, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}; // a host View's style prop

/** Renders a form body in a window of this size, laid out 700 dp tall. */
const show = async (window: {width: number; height: number}) => {
  Object.assign(mockWindow, window);
  await render(
    <FormScroll>
      <Text>Amount</Text>
    </FormScroll>,
  );
  const scrollView = () => {
    const [found] = screen.container.queryAll(node => node.type === 'RCTScrollView');
    if (!found) {
      throw new Error('no ScrollView');
    }
    return found;
  };
  await fireEvent.layout(scrollView(), {height: 700, width: window.width});
  return () => ({scroll: scrollView(), content: flat(screen.getByText('Amount').parent?.props['style'])});
};

afterEach(() => jest.restoreAllMocks());

it('portrait: the content is exactly the screen tall, and does not scroll', async () => {
  const parts = await show({width: 360, height: 800});
  expect(parts().content.height).toBe(700);
  expect(parts().scroll.props['scrollEnabled']).toBe(false);
});

it('landscape: the content grows past the screen and scrolls', async () => {
  const parts = await show({width: 800, height: 360});
  expect(parts().content.minHeight).toBe(700);
  expect(parts().content.height).toBeUndefined();
  expect(parts().scroll.props['scrollEnabled']).toBe(true);
});

it('Android: makes room for the keyboard while it is up, and scrolls while it is', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const listeners: Record<string, (event: KeyboardEvent) => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((type, listener) => {
    listeners[type] = listener as (event: KeyboardEvent) => void;
    return {remove: jest.fn()} as unknown as ReturnType<typeof Keyboard.addListener>; // only remove() is called
  });
  const parts = await show({width: 360, height: 800});
  const padding = () => flat(parts().scroll.props['contentContainerStyle']).paddingBottom;
  expect(padding()).toBe(0);
  await act(() => listeners['keyboardDidShow']?.({endCoordinates: {height: 300}} as KeyboardEvent)); // only the height is read
  expect(padding()).toBe(300);
  expect(parts().scroll.props['scrollEnabled']).toBe(true);
  await act(() => listeners['keyboardDidHide']?.({} as KeyboardEvent)); // the event is not read
  expect(padding()).toBe(0);
});

it('iOS adjusts its own insets for the keyboard', async () => {
  const parts = await show({width: 360, height: 800});
  expect(parts().scroll.props['automaticallyAdjustKeyboardInsets']).toBe(true);
});

it('Android: a rotation with the keyboard up reveals the focused field again in the new size', async () => {
  // Found on the Moto (2026-11-09): the keyboard reported its new height before
  // the form had its portrait size, so the field ended above the screen.
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'android');
  const listeners: Record<string, (event: KeyboardEvent) => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((type, listener) => {
    listeners[type] = listener as (event: KeyboardEvent) => void;
    return {remove: jest.fn()} as unknown as ReturnType<typeof Keyboard.addListener>; // only remove() is called
  });
  const reveals = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(undefined);
  const parts = await show({width: 800, height: 360});
  await act(() => listeners['keyboardDidShow']?.({endCoordinates: {height: 200}} as KeyboardEvent)); // only the height is read
  await act(() => jest.runOnlyPendingTimers());
  const afterShow = reveals.mock.calls.length;
  expect(afterShow).toBeGreaterThan(0);
  Object.assign(mockWindow, {width: 360, height: 800});
  await fireEvent.layout(parts().scroll, {height: 740, width: 360}); // the portrait size
  await act(() => jest.runOnlyPendingTimers());
  expect(reveals.mock.calls.length).toBeGreaterThan(afterShow);
  jest.useRealTimers();
});
