/**
 * What crosses into src/pro is checked where it enters (3.0). The rule every
 * reader here follows: something unreadable is "the store did not say", never
 * "the store said no" (law L3).
 */
import {
  UNSIGNED_INSTALL,
  parseEntitlement,
  parseOriginalInstall,
  parsePurchaseOutcome,
  parseStoreAnswer,
  parseStoreProducts,
} from '../../../src/pro/schema';

const RECORD = {productId: 'zero_pro', status: 'active', expiresAtMs: null, willRenew: true, verified: true};
const GARBLED = [undefined, null, '', 'not json', '{', '42', '"text"', '[]', '{}', 'null'];

describe('the store answer', () => {
  it('reads a known answer with its records', () => {
    const answer = {
      kind: 'known',
      entitlements: [RECORD, {...RECORD, status: 'pending', expiresAtMs: 1_800_000_000_000}],
    };
    expect(parseStoreAnswer(JSON.stringify(answer))).toEqual(answer);
  });

  it('reads "cannot say" with its reason', () => {
    expect(parseStoreAnswer('{"kind":"unknown","reason":"network"}')).toEqual({kind: 'unknown', reason: 'network'});
  });

  it.each(GARBLED)('treats %p as "cannot say"', json => {
    expect(parseStoreAnswer(json)).toEqual({kind: 'unknown', reason: 'malformed'});
  });

  it.each([
    ['a status it does not know', {...RECORD, status: 'paused'}],
    ['a missing verification flag', {productId: 'zero_pro', status: 'active', expiresAtMs: null, willRenew: null}],
    ['an end date that is not a number', {...RECORD, expiresAtMs: 'tomorrow'}],
    ['a record that is not an object', 42],
  ])('treats an answer holding %s as "cannot say", not as fewer purchases', (_what, record) => {
    const answer = {kind: 'known', entitlements: [RECORD, record]};
    expect(parseStoreAnswer(JSON.stringify(answer))).toEqual({kind: 'unknown', reason: 'malformed'});
  });
});

describe('the products on offer', () => {
  const MONTHLY = {
    id: 'zero_pro',
    displayPrice: '₹99.00',
    currencyCode: 'INR',
    period: 'month',
    trialDays: 14,
    offerToken: 'token',
  };
  const LIFETIME = {
    id: 'zero_pro_lifetime',
    displayPrice: '₹1,199.00',
    currencyCode: 'INR',
    period: null,
    trialDays: null,
    offerToken: null,
  };

  it('reads the list as the store gave it, price text untouched', () => {
    expect(parseStoreProducts(JSON.stringify([MONTHLY, LIFETIME]))).toEqual([MONTHLY, LIFETIME]);
  });

  it.each([...GARBLED, JSON.stringify([{...MONTHLY, trialDays: 0}]), JSON.stringify([{...MONTHLY, period: 'year'}])])(
    'offers nothing for %p',
    json => {
      expect(parseStoreProducts(json)).toEqual([]);
    },
  );
});

describe('how a purchase ended', () => {
  it.each(['purchased', 'pending', 'cancelled', 'alreadyOwned', 'unavailable', 'failed'] as const)(
    'reads %s',
    value => {
      expect(parsePurchaseOutcome(value)).toBe(value);
    },
  );

  it.each([undefined, null, '', 'ok', 'PURCHASED', '{"outcome":"purchased"}'])('reads %p as failed', value => {
    expect(parsePurchaseOutcome(value)).toBe('failed');
  });
});

describe('the first build this store account downloaded', () => {
  it('reads a signed build number', () => {
    expect(parseOriginalInstall('{"signed":true,"build":24}')).toEqual({signed: true, build: 24});
  });

  it.each([...GARBLED, '{"signed":true,"build":-1}', '{"signed":true,"build":"24"}', '{"signed":"yes","build":24}'])(
    'reads %p as unsigned and unknown',
    json => {
      expect(parseOriginalInstall(json)).toEqual(UNSIGNED_INSTALL);
    },
  );
});

describe('the stored entitlement', () => {
  const STORED = {
    state: 'subscribed',
    productId: 'zero_pro_monthly',
    expiresAtMs: 1_800_000_000_000,
    willRenew: true,
    alsoSubscribed: false,
    endedAtMs: null,
  };

  it('reads back what was stored', () => {
    expect(parseEntitlement(JSON.stringify(STORED))).toEqual(STORED);
  });

  it.each([...GARBLED, JSON.stringify({...STORED, state: 'gold'}), JSON.stringify({state: 'lifetime'})])(
    'reads %p as nothing stored',
    json => {
      expect(parseEntitlement(json)).toBeUndefined();
    },
  );
});
