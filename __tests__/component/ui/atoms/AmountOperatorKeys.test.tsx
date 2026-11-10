/**
 * The calculator's keys above the keyboard (audit 2026-11-08 §5 split them
 * out of AmountInput): + − × ÷ = in one row, each a labelled 44 dp button
 * that hands its key to the field, then Done where the keyboard has none.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {AmountOperatorKeys} from '../../../../src/ui/atoms/AmountOperatorKeys';
import {renderWithTheme, themeColors} from '../../../harness/render';

const show = async (operators: boolean, onDone?: () => void) => {
  const onPress = jest.fn();
  await renderWithTheme(
    <AmountOperatorKeys
      colors={await themeColors()}
      onPress={onPress}
      label={key => `key ${key}`}
      operators={operators}
      onDone={onDone}
      doneLabel="Done"
    />,
  );
  return onPress;
};

it('offers the four operators and =, each a labelled button that hands its key over', async () => {
  const onPress = await show(true);
  const keys = screen.getAllByRole('button').map(b => b.props['accessibilityLabel']);
  expect(keys).toEqual(['key +', 'key −', 'key ×', 'key ÷', 'key =']);
  for (const key of ['+', '−', '×', '÷', '=']) {
    await fireEvent.press(screen.getByLabelText(`key ${key}`));
  }
  expect(onPress.mock.calls.map(([key]) => key)).toEqual(['+', '−', '×', '÷', '=']);
});

it('every key is at least 44 dp tall to touch', async () => {
  await show(true, jest.fn());
  for (const button of screen.getAllByRole('button')) {
    const style = StyleSheet.flatten(button.props['style'] as StyleProp<ViewStyle>); // a Pressable's resolved style
    expect(style?.minHeight).toBeGreaterThanOrEqual(44);
  }
});

it('without the calculator, only Done shows, at the end of the row', async () => {
  const onDone = jest.fn();
  await show(false, onDone);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  const done = screen.getByRole('button', {name: 'Done'});
  expect(StyleSheet.flatten(done.props['style'] as StyleProp<ViewStyle>)?.marginLeft).toBe('auto'); // as above
  await fireEvent.press(done);
  expect(onDone).toHaveBeenCalledTimes(1);
});
