import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {nativeBilling, type Billing} from '../../pro/billing';
import {isPro} from '../../pro/entitlement';
import {getStoreStatus, restoreEntitlement} from '../../pro/entitlementStore';
import {useDialog} from '../context/DialogContext';

/**
 * What a person can do about their purchase from anywhere it is shown (the
 * Settings rows and the upgrade sheet): restore it, and open the store's own
 * page for the subscription. Each says how it went; neither can fail silently.
 */
export const useProActions = (billing: Billing = nativeBilling) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const [restoring, setRestoring] = useState(false);

  // Set before the first await: a second tap must not ask the store twice.
  const inFlight = useRef(false);

  const restore = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setRestoring(true);
    try {
      const entitlement = await restoreEntitlement(billing);
      const answered = getStoreStatus().lastAnswer?.kind === 'known';
      if (isPro(entitlement.state)) {
        await showAlert({type: 'success', message: t('pro.restored')});
      } else if (entitlement.state === 'pending') {
        // A purchase was found, and it has not cleared: not "nothing".
        await showAlert({type: 'info', message: t('pro.pending')});
      } else if (entitlement.state === 'onHold') {
        await showAlert({type: 'info', message: t('pro.statusOnHold')});
      } else if (answered) {
        await showAlert({type: 'info', message: t('pro.nothingToRestore')});
      } else {
        // The store did not say: nothing was changed, and that is not the same as "nothing found".
        await showAlert({type: 'error', message: t('pro.storeUnreachable')});
      }
    } finally {
      inFlight.current = false;
      setRestoring(false);
    }
  }, [billing, showAlert, t]);

  const manageSubscription = useCallback(async (): Promise<void> => {
    if (!(await billing.openManageSubscriptions())) {
      await showAlert({type: 'error', message: t('pro.manageFailed')});
    }
  }, [billing, showAlert, t]);

  return {restore, restoring, manageSubscription};
};
