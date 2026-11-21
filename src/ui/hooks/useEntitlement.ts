import {useSyncExternalStore} from 'react';
import {getEntitlement, subscribeEntitlement} from '../../pro/entitlementStore';
import type {Entitlement} from '../../pro/schema';

/**
 * What the store last said about who is paying, for the places that say it in
 * words (the Settings rows, the upgrade sheet, the notice). Whether a Pro
 * feature is drawn is a different question: ask `useProFeature`.
 */
export const useEntitlement = (): Entitlement =>
  useSyncExternalStore(subscribeEntitlement, getEntitlement, getEntitlement);
