/** What the last materialiser run left for the user, held outside React. */
import {getRecurringState, setRecurringState, subscribeRecurringState} from '../../../src/pro/recurringState';

it('tells its listeners, and settles to the one empty state', () => {
  const heard = jest.fn();
  const stop = subscribeRecurringState(heard);
  setRecurringState({behind: [{ruleId: 'r', title: 'Rent', missed: 3}], asks: []});
  expect(getRecurringState().behind).toHaveLength(1);
  const empty = getRecurringState();
  setRecurringState({behind: [], asks: []});
  setRecurringState({behind: [], asks: []});
  expect(getRecurringState()).not.toBe(empty);
  expect(getRecurringState()).toEqual({behind: [], asks: []});
  expect(heard).toHaveBeenCalledTimes(3);
  stop();
  setRecurringState({behind: [], asks: []});
  expect(heard).toHaveBeenCalledTimes(3);
});
