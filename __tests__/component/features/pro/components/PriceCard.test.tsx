/** One way to buy zero Pro: the price and the terms are on the card, before the button. */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {PriceCard} from '../../../../../src/features/pro/components/PriceCard';
import {renderWithTheme} from '../../../../harness/render';

const card = (more: Partial<React.ComponentProps<typeof PriceCard>> = {}) => (
  <PriceCard
    title="Monthly"
    price="₹99.00 a month"
    terms="Renews every month until you cancel."
    action="Subscribe"
    onPress={() => {}}
    busy={false}
    disabled={false}
    {...more}
  />
);

it('shows title, price and terms, and buys on the button', async () => {
  const onPress = jest.fn();
  await renderWithTheme(card({onPress, note: 'A thank-you price.'}));
  expect(screen.getByRole('header', {name: 'Monthly'})).toBeTruthy();
  expect(screen.getByText('₹99.00 a month')).toBeTruthy();
  expect(screen.getByText('Renews every month until you cancel.')).toBeTruthy();
  expect(screen.getByText('A thank-you price.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', {name: 'Subscribe'}));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('cannot be pressed while another purchase is under way', async () => {
  const onPress = jest.fn();
  await renderWithTheme(card({onPress, disabled: true}));
  await fireEvent.press(screen.getByRole('button', {name: 'Subscribe'}));
  expect(onPress).not.toHaveBeenCalled();
});
