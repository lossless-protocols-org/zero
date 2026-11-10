import {swipeActionsPreference} from '../../../src/platform/swipeActions';

describe('swipe actions preference', () => {
  it('defaults to enabled when nothing is stored', () => {
    expect(swipeActionsPreference.get()).toBe(true);
  });

  it('round-trips the stored value', () => {
    swipeActionsPreference.set(false);
    expect(swipeActionsPreference.get()).toBe(false);
    swipeActionsPreference.set(true);
    expect(swipeActionsPreference.get()).toBe(true);
  });
});
