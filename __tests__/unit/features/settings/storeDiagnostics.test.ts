/**
 * The Pro lines in Diagnostics (3.0): with no telemetry they are the only way
 * to tell a wrong tier from a store that is not answering, so they say what
 * was decided and what the store last said, and nothing about the buyer.
 */
import {storeDiagnosticLines} from '../../../../src/features/settings/storeDiagnostics';
import {NO_ENTITLEMENT} from '../../../../src/pro/entitlement';

it('describes a phone that never asked the store', () => {
  expect(storeDiagnosticLines({entitlement: NO_ENTITLEMENT, lastAnswer: null}, null)).toEqual([
    'pro: none',
    'product: none',
    'period ends: not known',
    'renews: not known',
    'ended: no',
    'store: not asked yet',
    'first seen: not recorded',
  ]);
});

it('describes a subscriber, with the dates the store gave', () => {
  const entitlement = {
    ...NO_ENTITLEMENT,
    state: 'subscribed' as const,
    productId: 'zero_pro_monthly',
    expiresAtMs: Date.UTC(2027, 3, 24, 9, 30),
    willRenew: true,
  };
  expect(storeDiagnosticLines({entitlement, lastAnswer: {kind: 'known', records: 1}}, '2.8.0')).toEqual([
    'pro: subscribed',
    'product: zero_pro_monthly',
    'period ends: 2027-04-24T09:30:00.000Z',
    'renews: yes',
    'ended: no',
    'store: answered, 1 record',
    'first seen: 2.8.0',
  ]);
});

it('says when the store did not say, and why, and when Pro ended', () => {
  const entitlement = {
    ...NO_ENTITLEMENT,
    state: 'expired' as const,
    productId: 'zero_pro',
    willRenew: false,
    endedAtMs: Date.UTC(2027, 4, 1),
  };
  const lines = storeDiagnosticLines({entitlement, lastAnswer: {kind: 'unknown', reason: 'noStore'}}, '2.7.1');
  expect(lines).toContain('pro: expired');
  expect(lines).toContain('renews: no');
  expect(lines).toContain('ended: 2027-05-01T00:00:00.000Z');
  expect(lines).toContain('store: did not say (noStore)');
});

it('says when a lifetime owner is still being charged for a subscription', () => {
  const entitlement = {
    ...NO_ENTITLEMENT,
    state: 'lifetime' as const,
    productId: 'zero_pro_lifetime',
    alsoSubscribed: true,
  };
  const lines = storeDiagnosticLines({entitlement, lastAnswer: {kind: 'known', records: 2}}, null);
  expect(lines[0]).toBe('pro: lifetime (a subscription is still renewing)');
  expect(lines).toContain('store: answered, 2 records');
});
