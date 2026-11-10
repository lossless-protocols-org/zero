/**
 * The one way a screen keeps what it shows fresh (audit 2026-11-08,
 * Appendix A): read on focus, read again after writes to its tables while
 * focused, once per tick, and nothing once it loses focus. React Navigation's
 * focus is the harness stand-in: mounted is focused, unmounted is not.
 */
import {act} from '@testing-library/react-native';
import {database} from '../../../../src/data/database/database';
import {useFreshWhileFocused} from '../../../../src/ui/hooks/useFreshWhileFocused';
import * as services from '../../../harness/services';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

beforeEach(async () => {
  jest.useFakeTimers({advanceTimers: true});
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});
afterEach(() => jest.useRealTimers());

const nextTick = () =>
  act(async () => {
    jest.advanceTimersByTime(1);
  });

const show = async () => {
  const read = jest.fn();
  const view = await renderHookInApp(() => useFreshWhileFocused(read, ['categories', 'expenses']));
  return {read, view};
};

it('reads once on focus', async () => {
  const {read} = await show();
  await nextTick();
  expect(read).toHaveBeenCalledTimes(1);
});

it('reads again after a write to a watched table, and not after others', async () => {
  const {read} = await show();
  await act(() => services.createCategory('Food', 'u1', null, null, 'expense'));
  await nextTick();
  expect(read).toHaveBeenCalledTimes(2);
  await act(() => services.createCurrency('INR', '₹', 'Indian Rupee', 'u1'));
  await nextTick();
  expect(read).toHaveBeenCalledTimes(2);
});

it('writes in the same tick are read once', async () => {
  const {read} = await show();
  await act(async () => {
    await services.createCategory('Food', 'u1', null, null, 'expense');
    await services.createCategory('Fuel', 'u1', null, null, 'expense');
  });
  await nextTick();
  expect(read).toHaveBeenCalledTimes(2);
});

it('reads nothing once the screen loses focus', async () => {
  const {read, view} = await show();
  await view.unmount();
  await act(() => services.createCategory('Food', 'u1', null, null, 'expense'));
  await nextTick();
  expect(read).toHaveBeenCalledTimes(1);
});
