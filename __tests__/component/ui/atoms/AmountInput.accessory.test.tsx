/**
 * Found on the iPhone 16 (iOS 27.2, 2.8 QA pass): every amount field was blank
 * and could not be tapped, so no expense, refund or money in could be added.
 * RN 0.88's InputAccessoryView keeps its own view in the layout; its first
 * layout pass un-hides it, screen-wide and painted with `backgroundColor`, over
 * the field. The accessory now sits in a zero-height clipping host.
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {Platform, StyleSheet} from 'react-native';
import {AmountInput} from '../../../../src/ui/atoms/AmountInput';
import {renderWithTheme} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/ui/hooks/useCurrency', () => ({useCurrency: () => ({symbol: '₹', code: 'INR'})}));
jest.mock('../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));
const mockCalculator = {on: false};
jest.mock('../../../../src/ui/hooks/usePreference', () => ({usePreference: () => mockCalculator.on}));

describe.each([false, true])('calculator %s', calculator => {
  beforeEach(() => {
    mockCalculator.on = calculator;
  });

  it('keeps the iOS keyboard accessory in a zero-height clipping host', async () => {
    expect(Platform.OS).toBe('ios');
    await renderWithTheme(<AmountInput value="" onChangeText={() => undefined} />);
    // InputAccessoryView's native view.
    const accessory = screen.container.queryAll(node => node.type === 'RCTInputAccessoryView');
    expect(accessory).toHaveLength(1);
    const host = accessory[0]?.parent;
    expect(StyleSheet.flatten(host?.props['style'])).toMatchObject({height: 0, overflow: 'hidden'});
  });
});
