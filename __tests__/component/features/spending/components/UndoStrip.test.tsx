/**
 * The "Transaction deleted · Undo" strip replaces the row in place. It was
 * 68 pt against a 56 pt row, so the list jumped on every delete. It now takes
 * the deleted row's measured height; the Undo button is drawn 36 pt tall and
 * keeps a 44 pt target through hitSlop.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {UndoStrip} from '../../../../../src/features/spending/components/UndoStrip';
import {renderWithTheme, themeColors} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const flat = (style: unknown) => StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}; // a host View's style prop

const show = async (rowHeight?: number) => {
  const onUndo = jest.fn();
  const colors = await themeColors();
  await renderWithTheme(<UndoStrip id="e1" colors={colors} onUndo={onUndo} edgeToEdge rowHeight={rowHeight} />);
  return {card: screen.getByTestId('undo-card'), button: screen.getByRole('button'), onUndo};
};

it('takes the height of the row it replaces', async () => {
  const {card} = await show(56);
  expect(flat(card.props['style']).height).toBe(56);
});

it('without a measurement, is built like a default row (10 pt padding around 36 pt)', async () => {
  const {card, button} = await show(undefined);
  const style = flat(card.props['style']);
  expect(style.height).toBeUndefined();
  expect(style.paddingVertical).toBe(10);
  expect(flat(button.props['style']).height).toBe(36);
});

it('the Undo button is 36 pt drawn but 44 pt to touch, and undoes', async () => {
  const {button, onUndo} = await show(56);
  const slop = button.props['hitSlop'] as {top: number; bottom: number}; // the strip passes an edge object
  expect(36 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  await fireEvent.press(button);
  expect(onUndo).toHaveBeenCalledWith('e1');
});
