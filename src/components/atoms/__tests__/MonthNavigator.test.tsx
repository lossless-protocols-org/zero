/**
 * M12 (v2.7.1): Home and Reports each drew their own ‹ month › pill. One atom
 * now; the forward chevron must swallow its tap when there is no next month
 * (a disabled touchable lets the tap fall through and open the picker).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {MonthNavigator} from '../MonthNavigator';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../../hooks/useThemeColors', () => ({__esModule: true, default: () => ({buttonText: '#fff'})}));

const render = async (props: Partial<React.ComponentProps<typeof MonthNavigator>> = {}) => {
  const onShift = jest.fn();
  const onOpenPicker = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <MonthNavigator label="October 2026" canGoForward onShift={onShift} onOpenPicker={onOpenPicker} {...props} />,
    );
  });
  const root = renderer!.root; // created in act above
  const button = (label: string) =>
    root.find(n => n.props['accessibilityLabel'] === label && typeof n.props['onPress'] === 'function');
  return {onShift, onOpenPicker, button, root};
};

describe('MonthNavigator', () => {
  it('compact shows the short month but still reads the full one', async () => {
    const {root, button} = await render({compact: true, shortLabel: 'Oct 2026'});
    const shown = root
      .findAll(n => typeof n.type === 'string' && typeof n.props['children'] === 'string')
      .map(n => n.props['children']);
    expect(shown).toContain('Oct 2026');
    expect(shown).not.toContain('October 2026');
    expect(button('October 2026').props['onPress']).toBeDefined();
  });

  it('the full-size navigator keeps the full label', async () => {
    const {root} = await render({shortLabel: 'Oct 2026'});
    const shown = root
      .findAll(n => typeof n.type === 'string' && typeof n.props['children'] === 'string')
      .map(n => n.props['children']);
    expect(shown).toContain('October 2026');
  });

  it('steps back and forward a month', async () => {
    const {onShift, button} = await render();
    button('home.previousMonth').props['onPress']();
    button('home.nextMonth').props['onPress']();
    expect(onShift.mock.calls).toEqual([[-1], [1]]);
  });

  it('swallows the forward tap when there is no next month', async () => {
    const {onShift, onOpenPicker, button} = await render({canGoForward: false});
    button('home.nextMonthUnavailable').props['onPress']();
    expect(onShift).not.toHaveBeenCalled();
    expect(onOpenPicker).not.toHaveBeenCalled();
  });

  it('opens the picker from the label when asked to', async () => {
    const {onOpenPicker, button} = await render();
    button('October 2026').props['onPress']();
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });
});
