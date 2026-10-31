/**
 * The "Transaction deleted · Undo" strip replaces the row in place. It was
 * 68 pt against a 56 pt row, so the list jumped on every delete. It now takes
 * the deleted row's measured height; the Undo button is drawn 36 pt tall and
 * keeps a 44 pt target through hitSlop.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import type {ThemeColors} from '../../../hooks/useThemeColors';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../../hooks/useThemeColors', () => ({__esModule: true, default: () => ({primaryText: '#111'})}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const {UndoStrip} = require('../UndoStrip') as typeof import('../UndoStrip');

// The strip reads only these tokens.
const colors = {
  secondaryAccent: '#eee',
  secondaryText: '#777',
  accentGreen: '#0a0',
  buttonText: '#fff',
} as unknown as ThemeColors;
const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}; // a host View's style prop

const render = async (rowHeight?: number) => {
  const onUndo = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <UndoStrip id="e1" colors={colors} onUndo={onUndo} edgeToEdge rowHeight={rowHeight} />,
    );
  });
  const root = renderer?.root;
  const card = root?.find(node => node.props['testID'] === 'undo-card');
  const button = root?.find(
    node => node.props['accessibilityRole'] === 'button' && typeof node.props['onPress'] === 'function',
  );
  return {card, button, onUndo};
};

it('takes the height of the row it replaces', async () => {
  const {card} = await render(56);
  expect(flat(card?.props['style']).height).toBe(56);
});

it('without a measurement, is built like a default row (10 pt padding around 36 pt)', async () => {
  const {card, button} = await render(undefined);
  const style = flat(card?.props['style']);
  expect(style.height).toBeUndefined();
  expect(style.paddingVertical).toBe(10);
  expect(flat(button?.props['style']).height).toBe(36);
});

it('the Undo button is 36 pt drawn but 44 pt to touch, and undoes', async () => {
  const {button, onUndo} = await render(56);
  const slop = button?.props['hitSlop'] as {top: number; bottom: number};
  expect(36 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  button?.props['onPress']();
  expect(onUndo).toHaveBeenCalledWith('e1');
});
