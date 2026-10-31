import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import type {ParseKeys} from 'i18next';
import {useDialog} from '../context/DialogContext';
import {appendErrorLog} from '../utils/errorLog';
import {goBack} from '../utils/navigationUtils';
import {isRecordNotFound} from '../watermelondb/services/recordNotFound';

/**
 * A failed save: the cause goes to the error log (Settings → Diagnostics), the
 * user gets `messageKey`. Stable across renders, so callers can list it as a
 * dependency.
 */
export const useReportFailure = (messageKey: ParseKeys) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  return useCallback(
    async (error: unknown) => {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t(messageKey)});
    },
    [messageKey, showAlert, t],
  );
};

/**
 * For edit forms (M19): a row deleted on another screen while its form was
 * open can never be saved, so say it is gone and leave, rather than "save
 * failed" on a form that would fail forever. Any other failure is reported
 * as `messageKey`, and the user stays to retry.
 */
export const useReportSaveFailure = (messageKey: ParseKeys) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const reportFailure = useReportFailure(messageKey);
  return useCallback(
    async (error: unknown) => {
      if (!isRecordNotFound(error)) {
        await reportFailure(error);
        return;
      }
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('common.recordMissing')});
      goBack();
    },
    [reportFailure, showAlert, t],
  );
};
