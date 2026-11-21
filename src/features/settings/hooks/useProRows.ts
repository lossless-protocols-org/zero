import {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {appendErrorLog} from '../../../platform/errorLog';
import {isPro} from '../../../pro/entitlement';
import type {Entitlement} from '../../../pro/schema';
import {useDialog} from '../../../ui/context/DialogContext';
import {useEntitlement} from '../../../ui/hooks/useEntitlement';
import {useKeptProData} from '../../../ui/hooks/useKeptProData';
import {useProActions} from '../../../ui/hooks/useProActions';

/** States in which a store subscription exists that the user may want to change or cancel. */
const HAS_SUBSCRIPTION: ReadonlyArray<Entitlement['state']> = ['trial', 'subscribed', 'grace', 'onHold'];

/**
 * The zero Pro section of Settings (3.0): the one upgrade entry, with a line
 * that says where the purchase stands; Restore; the store's page for a
 * subscription; and, when rows exist that only Pro shows, how many and their
 * removal (law L9).
 */
export const useProRows = () => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const entitlement = useEntitlement();
  const {restore, restoring, manageSubscription} = useProActions();
  const kept = useKeptProData();

  const status = useMemo((): string => {
    const {state, alsoSubscribed, willRenew, expiresAtMs} = entitlement;
    if (alsoSubscribed) {
      return t('pro.alsoSubscribed');
    }
    // Only the App Store reports an end date; where it does, a cancelled subscription says when it stops.
    if ((state === 'trial' || state === 'subscribed') && willRenew === false && expiresAtMs !== null) {
      return t('pro.endsOn', {date: formatDisplayDate(new Date(expiresAtMs), 'date')});
    }
    switch (state) {
      case 'lifetime':
        return t('pro.statusLifetime');
      case 'trial':
        return t('pro.statusTrial');
      case 'subscribed':
        return t('pro.statusSubscribed');
      case 'grace':
        return t('pro.statusGrace');
      case 'pending':
        return t('pro.statusPending');
      case 'onHold':
        return t('pro.statusOnHold');
      case 'expired':
        return t('pro.statusExpired');
      case 'revoked':
        return t('pro.statusRevoked');
      case 'none':
        return t('pro.rowSubtitle');
    }
  }, [entitlement, t]);

  const openUpgrade = useCallback(() => {
    void SheetManager.show('upgrade-sheet');
  }, []);

  const explainKept = useCallback(() => showAlert({type: 'info', message: t('pro.keptBody')}), [showAlert, t]);

  const removeKept = useCallback(async (): Promise<void> => {
    const confirmed = await showDialog({
      type: 'warning',
      message: t('pro.keptRemoveConfirm'),
      okLabel: t('pro.keptRemove'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    try {
      await kept.remove();
      await showAlert({type: 'success', message: t('pro.keptRemoved')});
    } catch (error) {
      // The removal is one write: it failed whole, so nothing was removed.
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('pro.keptRemoveFailed')});
    }
  }, [kept, showAlert, showDialog, t]);

  return {
    status,
    openUpgrade,
    showManage: HAS_SUBSCRIPTION.includes(entitlement.state) || entitlement.alsoSubscribed,
    manageSubscription,
    // Someone with Pro on has nothing to restore.
    showRestore: !isPro(entitlement.state),
    restore,
    restoring,
    keptCount: kept.count,
    explainKept,
    removeKept,
  };
};
