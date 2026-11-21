/**
 * What recurring entries still hold for the rest of the month (UX revamp v2):
 * read only when asked to, summed for a budget and for the money to spend.
 */
import {waitFor} from '@testing-library/react-native';
import {useCommitments} from '../../../../src/ui/hooks/useCommitments';
import {todayIsoDay} from '../../../../src/domain/dates';
import {seedAccounts} from '../../../harness/accountsSeed';
import {seedRule} from '../../../harness/recurringSeed';
import {renderHookInApp} from '../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

it('reads what is due from today to the end of the month, and sums it both ways', async () => {
  const seed = await seedAccounts();
  // Due today (always inside the current month), once a year: exactly one occurrence.
  await seedRule(seed, {startDate: todayIsoDay(), cadence: 'yearly', amount: 750}, todayIsoDay());
  await seedRule(
    seed,
    {
      target: 'transfer',
      title: 'SIP',
      categoryId: '',
      toAccountId: seed.fund,
      amount: 1000,
      startDate: todayIsoDay(),
      cadence: 'yearly',
    },
    todayIsoDay(),
  );
  const {result} = await renderHookInApp(() => useCommitments(true));
  await waitFor(() => expect(result.current.due).toHaveLength(2));
  // The budget's bills are the expenses only; what leaves the money to spend also counts money put away.
  expect(result.current.bills).toBe(750);
  expect(result.current.still.total).toBe(1750);
  expect(result.current.nextStart > result.current.lastDay).toBe(true);
});

it('reads nothing when it is off: a free user gets exactly what they had', async () => {
  const seed = await seedAccounts();
  await seedRule(seed, {startDate: todayIsoDay(), cadence: 'yearly'}, todayIsoDay());
  const {result} = await renderHookInApp(() => useCommitments(false));
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(result.current).toMatchObject({due: [], bills: 0, still: {total: 0, items: [], varies: []}});
});
