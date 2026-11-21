import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getFirstSeenVersion} from '../../../platform/firstSeenVersion';
import {nativeBilling, type Billing} from '../../../pro/billing';
import {isThanksEligible} from '../../../pro/eligibility';
import {isPro} from '../../../pro/entitlement';
import {getStoreStatus, refreshEntitlement, restoreEntitlement} from '../../../pro/entitlementStore';
import type {StoreProduct} from '../../../pro/schema';
import {upgradeOffer, UPGRADE_PRODUCT_IDS, type UpgradeOffer} from '../../../pro/upgradeOffer';
import {useDialog} from '../../../ui/context/DialogContext';

/**
 * What the store has to offer, or why there is nothing to show:
 * - `unavailable`: this build has no store (the GitHub build), or cannot sell yet;
 * - `empty`: the store was asked and returned no product (offline, a store error).
 */
export type UpgradeState =
  {phase: 'loading'} | {phase: 'unavailable'} | {phase: 'empty'} | {phase: 'ready'; offer: UpgradeOffer};

/**
 * The upgrade sheet's dealings with the store: what is on offer, and buying
 * it. Every outcome is said in words, and Pro is announced only once the
 * entitlement says so: a payment still clearing is called exactly that.
 * `onDone` runs when there is nothing left to do on the sheet.
 */
export const useUpgrade = (onDone: () => void, billing: Billing = nativeBilling) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const [state, setState] = useState<UpgradeState>({phase: 'loading'});
  const [buying, setBuying] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    setState({phase: 'loading'});
    const next = await (async (): Promise<UpgradeState> => {
      if (!(await billing.isAvailable())) {
        return {phase: 'unavailable'};
      }
      const [products, originalInstall] = await Promise.all([
        billing.getProducts(UPGRADE_PRODUCT_IDS),
        billing.getOriginalInstall(),
      ]);
      const eligible = isThanksEligible({
        firstSeenVersion: getFirstSeenVersion(),
        originalInstall,
        nowMs: Date.now(),
      });
      const offer = upgradeOffer(products, eligible);
      return offer.monthly || offer.lifetime ? {phase: 'ready', offer} : {phase: 'empty'};
    })();
    if (mounted.current) {
      setState(next);
    }
  }, [billing]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Set before the first await, so a second tap cannot start a second purchase in the same frame.
  const inFlight = useRef(false);

  const buy = useCallback(
    async (product: StoreProduct): Promise<void> => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setBuying(product.id);
      try {
        const outcome = await billing.purchase(product.id, product.offerToken);
        if (outcome === 'cancelled') {
          return;
        }
        // "Already owned" is a purchase this phone has not heard of yet: ask the store to restore it.
        const entitlement =
          outcome === 'alreadyOwned' ? await restoreEntitlement(billing) : await refreshEntitlement(billing);
        const storeAnswered = getStoreStatus().lastAnswer?.kind === 'known';
        if (outcome === 'unavailable') {
          await showAlert({type: 'error', message: t('pro.purchaseUnavailable')});
        } else if (outcome === 'failed') {
          await showAlert({type: 'error', message: t('pro.purchaseFailed')});
        } else if (outcome === 'pending' || entitlement.state === 'pending') {
          // Paid for and not cleared. Said first: a subscriber buying lifetime is already Pro, and
          // must still hear that this payment has not gone through yet.
          await showAlert({type: 'info', message: t('pro.pending')});
          onDone();
        } else if (isPro(entitlement.state)) {
          await showAlert({type: 'success', message: t('pro.purchased')});
          onDone();
        } else if (outcome === 'alreadyOwned') {
          // The store says owned and the restore does not show it: say which of the two happened.
          await showAlert(
            storeAnswered
              ? {type: 'info', message: t('pro.nothingToRestore')}
              : {type: 'error', message: t('pro.storeUnreachable')},
          );
        } else {
          // "Purchased", and the store's own answer has not caught up with it yet.
          await showAlert({type: 'info', message: t('pro.pending')});
          onDone();
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBuying(null);
        }
      }
    },
    [billing, onDone, showAlert, t],
  );

  return {state, buying, buy, retry: load};
};
