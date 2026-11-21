import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectDebtorData} from '../../../store/slices/debtorDataSlice';
import {useDialog} from '../../../ui/context/DialogContext';
import {useProFeature} from '../../../ui/hooks/useProFeature';
import {CLASS_ICON} from '../../../ui/accountWords';
import {moveTallyToAccount} from '../../../data/services/tallyService';
import {AccountRuleError} from '../../../data/services/accountService';
import {debtorGroupOf} from '../../../domain/debtType';
import {getISODateTime, todayIsoDay} from '../../../domain/dates';
import {appendErrorLog} from '../../../platform/errorLog';
import {goBack} from '../../../platform/navigationUtils';

/**
 * Making a card or loan tally a full card or loan (Pro; approved model A2).
 * `offered` is false for a person and without Pro: then nothing is shown.
 * The user says yes first; the tally's balance is carried across and the
 * tally is closed with one entry, so its history stays and nothing is
 * deleted (data/services/tallyService).
 */
export const useMoveTally = (debtorId: string) => {
  const {t} = useTranslation();
  const pro = useProFeature('accounts');
  const userId = useAppSelector(selectUserId);
  const debtor = useAppSelector(selectDebtorData).find(row => String(row.id) === debtorId);
  const {showAlert, showDialog} = useDialog();
  const [busy, setBusy] = useState(false);

  const move = useCallback(
    async (accountClass: 'card' | 'loan') => {
      if (busy || !debtor) {
        return;
      }
      const agreed = await showDialog({
        type: 'info',
        message: t(accountClass === 'card' ? 'debts.moveToCardConfirm' : 'debts.moveToLoanConfirm', {
          name: debtor.title,
        }),
        okLabel: t('debts.moveConfirm'),
      });
      if (!agreed) {
        return;
      }
      setBusy(true);
      try {
        await moveTallyToAccount(
          userId,
          debtorId,
          accountClass,
          todayIsoDay(),
          getISODateTime(),
          t('debts.movedNote'),
          CLASS_ICON[accountClass],
        );
      } catch (error) {
        setBusy(false);
        if (!(error instanceof AccountRuleError)) {
          appendErrorLog(error, false);
        }
        await showAlert({
          type: 'error',
          message:
            error instanceof AccountRuleError && error.rule === 'nameTaken'
              ? t('accounts.nameTaken')
              : t('debts.moveFailed'),
        });
        return;
      }
      setBusy(false);
      goBack();
    },
    [busy, debtor, debtorId, showAlert, showDialog, t, userId],
  );

  return {offered: pro && !!debtor && debtorGroupOf(debtor.type) === 'accounts', busy, move};
};
