/** The rule form's own rules (P9): what makes a rule savable, and the target switch. */
import {act, waitFor} from '@testing-library/react-native';
import {useRuleForm} from '../../../../../src/features/recurring/hooks/useRuleForm';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
});

it('an expense needs a name, an amount (or "varies") and a category', async () => {
  const {result} = await renderHookInApp(() => useRuleForm());
  await waitFor(() => expect(result.current.from?.id).toBe(seed.cash));
  expect(result.current.isValid).toBe(false);
  await act(async () => {
    result.current.setTitle('Gym');
    result.current.setCategoryId(seed.snacks);
  });
  expect(result.current.isValid).toBe(false);
  await act(async () => result.current.setVaries(true));
  expect(result.current.isValid).toBe(true);
  await act(async () => result.current.setEndDate('2020-01-01'));
  expect(result.current.isValid).toBe(false);
});

it('switching to a transfer drops the category and picks a second account; to money in clears the to', async () => {
  const {result} = await renderHookInApp(() => useRuleForm());
  await waitFor(() => expect(result.current.from?.id).toBe(seed.cash));
  await act(async () => result.current.setCategoryId(seed.snacks));
  await act(async () => result.current.setTarget('transfer'));
  expect(result.current.categories).toEqual([]);
  expect(result.current.to?.id).toBeDefined();
  expect(result.current.to?.id).not.toBe(seed.cash);
  await act(async () => result.current.setTarget('income'));
  expect(result.current.to).toBeUndefined();
});
