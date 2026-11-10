/**
 * Found on the Moto in the 2.7.1 gate pass: the swipe tutorial's "Got it" was
 * a 24 dp-tall target with no role — M30 missed it. It now reaches 44 pt with
 * the shared hitSlop and reads as a button.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {hitSlop} from '../../../../src/ui/globalStyles';
import {SwipeTutorialTooltip} from '../../../../src/ui/atoms/SwipeTutorialTooltip';
import {renderWithTheme} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

it('"Got it" is a labelled button with the shared touch slop', async () => {
  const onDismiss = jest.fn();
  await renderWithTheme(<SwipeTutorialTooltip onDismiss={onDismiss} />);
  const button = screen.getByRole('button');
  expect(button.props['hitSlop']).toEqual(hitSlop);
  await fireEvent.press(button);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
