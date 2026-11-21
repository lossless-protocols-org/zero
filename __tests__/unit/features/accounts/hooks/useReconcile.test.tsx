/**
 * Reconcile's preview (P8 review): an answer that arrives after the input
 * changed is not shown, so clearing the field never brings back the gap of a
 * number that is gone.
 */
import {act, waitFor} from '@testing-library/react-native';
import * as checkpoints from '../../../../../src/data/services/checkpointService';
import {useReconcile} from '../../../../../src/features/accounts/hooks/useReconcile';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

afterEach(() => jest.restoreAllMocks());

it('an answer for a number since cleared is dropped', async () => {
  const seed = await seedAccounts();
  let release: (value: {derived: number; gap: number}) => void = () => undefined;
  jest.spyOn(checkpoints, 'previewCheckpoint').mockImplementation(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const {result} = await renderHookInApp(() => useReconcile(seed.bank));
  await waitFor(() => expect(result.current.account).not.toBeNull());
  await act(async () => result.current.setBalance('100'));
  await act(async () => result.current.setBalance(''));
  await act(async () => release({derived: 5000, gap: -4900}));
  expect(result.current.preview).toBeNull();
});
