/**
 * Settings → "Month starts on" (3.0 Pro, P11): the row says the day, the
 * sheet opens on it, and saving writes the user row (the session then tells
 * every month). A failed save is said. Real LokiJS database and store.
 */
import {act} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {followSession} from '../../../../../src/store/followSession';
import * as userService from '../../../../../src/data/services/userService';
import {useMonthStartSetting} from '../../../../../src/features/settings/hooks/useMonthStartSetting';
import {getMonthStartDay} from '../../../../../src/pro/monthStart';
import * as services from '../../../../harness/services';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

type Payload = {current?: number; onSelect?: (day: number) => void};
let shown: Payload | undefined;
let stop: () => void = () => undefined;
const tick = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

beforeAll(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  await services.createUser('Ravi', '');
  setEntitlement({state: 'lifetime'});
  await store.dispatch(fetchUserData());
  stop = followSession(store.dispatch);
  setMockTranslations({'settings.monthStartDay': 'Day {{day}}'});
});
afterAll(() => {
  stop();
  setMockTranslations({});
});
beforeEach(() => {
  resetDialogs();
  shown = undefined;
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_id, options) => {
    shown = (options as {payload?: Payload} | undefined)?.payload;
    return undefined;
  });
});
afterEach(() => jest.restoreAllMocks());

it('says the day, opens the picker on it, and a new day reaches every month through the user row', async () => {
  const {result} = await renderHookInApp(() => useMonthStartSetting());
  expect(result.current).toMatchObject({day: 1, label: 'settings.monthStartFirst'});
  await act(async () => result.current.open());
  expect(shown?.current).toBe(1);
  await act(async () => shown?.onSelect?.(7));
  await tick();
  await tick();
  expect((await userService.getAllUsers())[0]?.monthStartDay).toBe(7);
  expect(getMonthStartDay()).toBe(7);
  expect(result.current).toMatchObject({day: 7, label: 'Day 7'});
});

it('picking the same day writes nothing', async () => {
  const write = jest.spyOn(userService, 'setMonthStartDay');
  const {result} = await renderHookInApp(() => useMonthStartSetting());
  await act(async () => result.current.open());
  await act(async () => shown?.onSelect?.(result.current.day));
  expect(write).not.toHaveBeenCalled();
});

it('a save that fails is said, and the day stays', async () => {
  jest.spyOn(userService, 'setMonthStartDay').mockRejectedValue(new Error('disk'));
  const {result} = await renderHookInApp(() => useMonthStartSetting());
  const before = result.current.day;
  await act(async () => result.current.open());
  await act(async () => shown?.onSelect?.(20));
  await tick();
  expect(dialogsSaid().join(' ')).toContain('settings.saveFailed');
  expect(result.current.day).toBe(before);
});
