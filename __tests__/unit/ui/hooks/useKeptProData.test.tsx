/** The rows a person owns and cannot see (law L9): counted without Pro, zero with it, and removable. */
import {act, renderHook, waitFor} from '@testing-library/react-native';
import * as proData from '../../../../src/data/services/proDataService';
import {useKeptProData} from '../../../../src/ui/hooks/useKeptProData';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';

// Settings counts kept Pro data on focus (useFreshWhileFocused); rendered alone, mounted is focused.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let kept = 0;
beforeEach(() => {
  kept = 3;
  jest.spyOn(proData, 'countKeptProData').mockImplementation(async () => kept);
  jest.spyOn(proData, 'removeProData').mockImplementation(async () => {
    kept = 0;
  });
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

it('counts what is hidden when Pro is off', async () => {
  const {result} = await renderHook(() => useKeptProData());
  await waitFor(() => expect(result.current.count).toBe(3));
});

it('is zero with Pro on: nothing is hidden then', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHook(() => useKeptProData());
  await waitFor(() => expect(proData.countKeptProData).not.toHaveBeenCalled());
  expect(result.current.count).toBe(0);
  // Pro ends: the same rows are now hidden, and counted.
  await act(async () => setEntitlement({state: 'expired'}));
  await waitFor(() => expect(result.current.count).toBe(3));
});

it('removes on request and counts again', async () => {
  const {result} = await renderHook(() => useKeptProData());
  await waitFor(() => expect(result.current.count).toBe(3));
  await act(() => result.current.remove());
  expect(proData.removeProData).toHaveBeenCalledTimes(1);
  expect(result.current.count).toBe(0);
});

it('a count that fails hides the row and loses nothing', async () => {
  jest.mocked(proData.countKeptProData).mockRejectedValue(new Error('database closed'));
  const {result} = await renderHook(() => useKeptProData());
  await waitFor(() => expect(proData.countKeptProData).toHaveBeenCalled());
  expect(result.current.count).toBe(0);
});
