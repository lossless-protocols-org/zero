/**
 * Characterization for S4 (v2.7.1): redux-persist ran with an empty whitelist,
 * so it persisted nothing while wrapping the root reducer and holding first
 * render behind <PersistGate>. Without it the store must still boot
 * synchronously with every slice at its initial state, and nothing may depend
 * on redux-persist's bookkeeping.
 */
import store from '../store';
import rootReducer from '../rootReducer';

const SLICES = [
  'currencyData',
  'userName',
  'userId',
  'category',
  'expense',
  'debtor',
  'debt',
  'individualDebtor',
  'monthSelection',
  'budget',
  'dataError',
];

describe('redux store (S4)', () => {
  it('boots with every slice hydrated to its initial state', () => {
    expect(store.getState()).toEqual(rootReducer(undefined, {type: '@@INIT'}));
  });

  it('carries no redux-persist bookkeeping', () => {
    expect(Object.keys(store.getState()).sort()).toEqual([...SLICES].sort());
  });

  it("opens on the device's current month (monthSelection is not restored from storage)", () => {
    const now = new Date();
    expect(store.getState().monthSelection).toEqual({monthIndex: now.getMonth(), year: now.getFullYear()});
  });
});
