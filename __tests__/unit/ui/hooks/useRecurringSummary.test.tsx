/** The Money tab's recurring line (P9): how many rules, the next this week, and what waits. */
import {act, waitFor} from '@testing-library/react-native';
import {useRecurringSummary} from '../../../../src/ui/hooks/useRecurringSummary';
import {setRecurringState} from '../../../../src/pro/recurringState';
import {todayIsoDay} from '../../../../src/domain/dates';
import {seedAccounts} from '../../../harness/accountsSeed';
import {seedRule} from '../../../harness/recurringSeed';
import {renderHookInApp} from '../../../harness/render';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

it('counts the rules, names what is next, and counts what waits', async () => {
  const seed = await seedAccounts();
  await seedRule(seed, {startDate: todayIsoDay(), cadence: 'everyNDays'}, todayIsoDay());
  const {result} = await renderHookInApp(() => useRecurringSummary());
  await waitFor(() => expect(result.current.count).toBe(1));
  expect(result.current.next?.title).toBe('Rent');
  await act(async () => setRecurringState({behind: [{ruleId: 'r', title: 'Rent', missed: 2}], asks: []}));
  expect(result.current.waiting).toBe(1);
  await act(async () => setRecurringState({behind: [], asks: []}));
});
