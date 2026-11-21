import type {getStoreStatus} from '../../pro/entitlementStore';

/**
 * What zero has decided about Pro, and what the store last said, as the lines
 * Diagnostics shows and puts in a shared report (3.0). In English and terse on
 * purpose, like the rest of a report: they are read by whoever is helping, not
 * by the person holding the phone. They name a product and a state; never a
 * price, an order or anything about the buyer.
 */
export const storeDiagnosticLines = (
  {entitlement, lastAnswer}: ReturnType<typeof getStoreStatus>,
  firstSeenVersion: string | null,
): string[] => {
  const store =
    lastAnswer === null
      ? 'not asked yet'
      : lastAnswer.kind === 'known'
        ? `answered, ${lastAnswer.records} ${lastAnswer.records === 1 ? 'record' : 'records'}`
        : `did not say (${lastAnswer.reason})`;
  return [
    `pro: ${entitlement.state}${entitlement.alsoSubscribed ? ' (a subscription is still renewing)' : ''}`,
    `product: ${entitlement.productId ?? 'none'}`,
    `period ends: ${entitlement.expiresAtMs === null ? 'not known' : new Date(entitlement.expiresAtMs).toISOString()}`,
    `renews: ${entitlement.willRenew === null ? 'not known' : entitlement.willRenew ? 'yes' : 'no'}`,
    `ended: ${entitlement.endedAtMs === null ? 'no' : new Date(entitlement.endedAtMs).toISOString()}`,
    `store: ${store}`,
    `first seen: ${firstSeenVersion ?? 'not recorded'}`,
  ];
};
