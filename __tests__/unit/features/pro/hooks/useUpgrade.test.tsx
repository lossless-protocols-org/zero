/**
 * The upgrade sheet's dealings with the store (3.0): what is on offer, and
 * how each way a purchase can end is said. Pro is announced only when the
 * entitlement says so.
 */
import {act, renderHook, waitFor} from '@testing-library/react-native';
import {useUpgrade} from '../../../../../src/features/pro/hooks/useUpgrade';
import type {StoreProduct} from '../../../../../src/pro/schema';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {nextStoreAnswer, resetEntitlement, storeAsked} from '../../../../harness/mocks/entitlement';
import {createFakeBilling, type FakeBilling} from '../../../../harness/fakeBilling';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);

const MONTHLY: StoreProduct = {
  id: 'zero_pro',
  displayPrice: '₹99.00',
  currencyCode: 'INR',
  period: 'month',
  trialDays: 14,
  offerToken: 'trial-token',
};
const LIFETIME: StoreProduct = {
  id: 'zero_pro_lifetime',
  displayPrice: '₹1,199.00',
  currencyCode: 'INR',
  period: null,
  trialDays: null,
  offerToken: null,
};

let billing: FakeBilling;
let done: jest.Mock;

beforeEach(() => {
  billing = createFakeBilling();
  billing.products = [MONTHLY, LIFETIME];
  done = jest.fn();
});
afterEach(() => {
  resetEntitlement();
  resetDialogs();
});

const ready = async () => {
  const hook = await renderHook(() => useUpgrade(done, billing));
  await waitFor(() => expect(hook.result.current.state.phase).not.toBe('loading'));
  return hook;
};

describe('what is on offer', () => {
  it('is what the store returned', async () => {
    const {result} = await ready();
    expect(result.current.state).toMatchObject({phase: 'ready', offer: {monthly: MONTHLY, lifetime: LIFETIME}});
  });

  it('is nothing in a build with no store, which is not asked for products', async () => {
    billing.isAvailable = async () => false;
    const {result} = await ready();
    expect(result.current.state).toEqual({phase: 'unavailable'});
    expect(billing.calls).toEqual([]);
  });

  it('is "the store did not answer" when it returns no product, and can be asked again', async () => {
    billing.products = [];
    const {result} = await ready();
    expect(result.current.state).toEqual({phase: 'empty'});
    billing.products = [LIFETIME];
    await act(() => result.current.retry());
    expect(result.current.state).toMatchObject({phase: 'ready', offer: {monthly: null, lifetime: LIFETIME}});
  });
});

describe('buying', () => {
  it('passes the offer the store gave, announces Pro once the entitlement says so, and closes', async () => {
    nextStoreAnswer({state: 'trial', productId: 'zero_pro'}, {kind: 'known', records: 1});
    const {result} = await ready();
    const purchase = jest.spyOn(billing, 'purchase');
    await act(() => result.current.buy(MONTHLY));
    expect(purchase).toHaveBeenCalledWith('zero_pro', 'trial-token');
    expect(storeAsked()).toEqual(['refresh']);
    expect(dialogsSaid()).toEqual(['success: pro.purchased']);
    expect(done).toHaveBeenCalledTimes(1);
    expect(result.current.buying).toBeNull();
  });

  it('a payment still clearing is called that, never Pro', async () => {
    billing.nextPurchase('pending');
    nextStoreAnswer({state: 'pending', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['info: pro.pending']);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('a subscriber whose lifetime payment is still clearing hears that, not "Pro is on"', async () => {
    // Already Pro through the subscription: the entitlement alone would read as a success.
    billing.nextPurchase('pending');
    nextStoreAnswer({state: 'subscribed', productId: 'zero_pro'}, {kind: 'known', records: 2});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['info: pro.pending']);
  });

  it('a purchase the store has not confirmed yet is not announced as Pro', async () => {
    // "purchased" from the sheet, and the store's own answer still lags behind it.
    nextStoreAnswer({}, {kind: 'unknown', reason: 'NETWORK_ERROR'});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['info: pro.pending']);
  });

  it('cancelling says nothing and asks the store nothing', async () => {
    billing.nextPurchase('cancelled');
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual([]);
    expect(storeAsked()).toEqual([]);
    expect(done).not.toHaveBeenCalled();
  });

  it('"already owned" restores it', async () => {
    billing.nextPurchase('alreadyOwned');
    nextStoreAnswer({state: 'lifetime', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(storeAsked()).toEqual(['restore']);
    expect(dialogsSaid()).toEqual(['success: pro.purchased']);
  });

  it('"already owned" that the store then does not show is said plainly', async () => {
    billing.nextPurchase('alreadyOwned');
    nextStoreAnswer({}, {kind: 'known', records: 0});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['info: pro.nothingToRestore']);
    expect(done).not.toHaveBeenCalled();
  });

  it('"already owned" for a payment still clearing says it is clearing, not that nothing was found', async () => {
    // Paid by a slow method, then tapped Buy again: Play answers "already owned".
    billing.nextPurchase('alreadyOwned');
    nextStoreAnswer({state: 'pending', productId: 'zero_pro_lifetime'}, {kind: 'known', records: 1});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['info: pro.pending']);
  });

  it('"already owned" with a store that then cannot say reports that, not "nothing found"', async () => {
    billing.nextPurchase('alreadyOwned');
    nextStoreAnswer({}, {kind: 'unknown', reason: 'NETWORK_ERROR'});
    const {result} = await ready();
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['error: pro.storeUnreachable']);
  });

  it('a second tap while one purchase is under way starts nothing', async () => {
    const {result} = await ready();
    let finish: (outcome: 'cancelled') => void = () => {};
    const purchase = jest.fn(() => new Promise<'cancelled'>(resolve => (finish = resolve)));
    billing.purchase = purchase;
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      // Two taps in one frame, before any state has changed.
      first = result.current.buy(LIFETIME);
      await result.current.buy(MONTHLY);
    });
    expect(purchase).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish('cancelled');
      await first;
    });
    // And the next one goes through.
    await act(async () => {
      first = result.current.buy(MONTHLY);
      finish('cancelled');
      await first;
    });
    expect(purchase).toHaveBeenCalledTimes(2);
  });

  it('a store that cannot sell, and a purchase that fails, each say so and leave the sheet open', async () => {
    const {result} = await ready();
    billing.nextPurchase('unavailable');
    await act(() => result.current.buy(LIFETIME));
    billing.nextPurchase('failed');
    await act(() => result.current.buy(LIFETIME));
    expect(dialogsSaid()).toEqual(['error: pro.purchaseUnavailable', 'error: pro.purchaseFailed']);
    expect(done).not.toHaveBeenCalled();
  });

  it('names what is being bought while the store is busy with it', async () => {
    const {result} = await ready();
    let finish: (outcome: 'cancelled') => void = () => {};
    billing.purchase = () => new Promise(resolve => (finish = resolve));
    let buying: Promise<void> = Promise.resolve();
    await act(async () => {
      buying = result.current.buy(MONTHLY);
    });
    expect(result.current.buying).toBe('zero_pro');
    await act(async () => {
      finish('cancelled');
      await buying;
    });
    expect(result.current.buying).toBeNull();
  });
});
