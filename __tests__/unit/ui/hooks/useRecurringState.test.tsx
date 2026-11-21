/** What the last run left for the user, as screens read it (P9). */
import {act} from '@testing-library/react-native';
import {useRecurringState} from '../../../../src/ui/hooks/useRecurringState';
import {setRecurringState} from '../../../../src/pro/recurringState';
import {renderHookInApp} from '../../../harness/render';

it('follows the store, and re-renders when it changes', async () => {
  const {result} = await renderHookInApp(() => useRecurringState());
  expect(result.current).toEqual({behind: [], asks: []});
  await act(async () => setRecurringState({behind: [{ruleId: 'r', title: 'Rent', missed: 2}], asks: []}));
  expect(result.current.behind).toHaveLength(1);
  await act(async () => setRecurringState({behind: [], asks: []}));
});
