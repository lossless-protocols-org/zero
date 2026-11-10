/**
 * The amount field's calculator, apart from the field (audit 2026-11-08 §5):
 * the form only ever receives an amount, never the sum the user types.
 */
import {act, renderHook} from '@testing-library/react-native';
import {useAmountCalculator} from '../../../../src/ui/hooks/useAmountCalculator';

const mount = async (enabled: boolean, initial = '') => {
  const reported: string[] = [];
  const {result, rerender} = await renderHook(
    ({value}: {value: string}) =>
      useAmountCalculator({value, onChangeText: t => reported.push(t), decimals: 2, enabled}),
    {initialProps: {value: initial}},
  );
  const calc = () => result.current;
  const setValue = (value: string) => rerender({value});
  return {calc, reported, setValue};
};

it('shows the sum, reports only its result, and settles to the result', async () => {
  const {calc, reported} = await mount(true);
  await act(() => calc().type('120+35'));
  expect(calc().text).toBe('120+35');
  expect(reported.at(-1)).toBe('155');
  expect(calc().result).toMatchObject({kind: 'value', value: 155});
  await act(() => calc().press('='));
  expect(calc().text).toBe('155');
  expect(calc().result).toBeNull();
});

it('reports nothing while the sum is not an amount', async () => {
  const {calc, reported} = await mount(true);
  await act(() => calc().type('10÷0'));
  expect(reported.at(-1)).toBe('');
  expect(calc().result).toMatchObject({kind: 'error', reason: 'divideByZero'});
});

it('a value the form sets itself replaces the sum', async () => {
  const {calc, setValue} = await mount(true);
  await act(() => calc().type('5+5'));
  await setValue('42');
  expect(calc().text).toBe('42');
});

it('with the calculator off: normalises typing (comma decimal) and shows the value', async () => {
  const {calc, reported} = await mount(false, '7');
  await act(() => calc().type('12,5'));
  expect(reported.at(-1)).toBe('12.5');
  expect(calc().text).toBe('7'); // the form owns the value
  expect(calc().result).toBeNull();
});
