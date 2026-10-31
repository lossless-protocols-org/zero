/**
 * Found on the Moto in the 2.7.1 gate pass: the swipe tutorial's "Got it" was
 * a 24 dp-tall target with no role — M30 missed it. It now reaches 44 pt with
 * the shared hitSlop and reads as a button.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {hitSlop} from '../../../styles/globalStyles';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../../hooks/useThemeColors', () => ({
  __esModule: true,
  default: () => ({accentGreen: '#00aa00', buttonText: '#ffffff'}),
}));

// required after jest.mock so the mock applies; the cast names the module's own type
const SwipeTutorialTooltip = (require('../SwipeTutorialTooltip') as typeof import('../SwipeTutorialTooltip')).default;

it('"Got it" is a labelled button with the shared touch slop', async () => {
  const onDismiss = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<SwipeTutorialTooltip onDismiss={onDismiss} />);
  });
  const button = renderer?.root.find(
    node => typeof node.props['onPress'] === 'function' && node.props['accessibilityRole'] === 'button',
  );
  expect(button?.props['hitSlop']).toEqual(hitSlop);
  button?.props['onPress']();
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
