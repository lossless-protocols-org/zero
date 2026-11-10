import {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../context/DialogContext';
import {logRejection} from '../../platform/errorLog';
import {useDataErrorSummary} from '../hooks/useDataError';

/**
 * One dialog per session for the first failed data load (M1, v2.7.1); the
 * banners carry it from then on. Mounted once in App. Renders nothing.
 */
export const DataErrorDialog = () => {
  const {showAlert} = useDialog();
  const {t} = useTranslation();
  // The usual advice (export, reinstall) is impossible without a user row.
  const {hasError, noUserRow} = useDataErrorSummary();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!hasError || shownRef.current) {
      return;
    }
    shownRef.current = true;
    // Rejects only if the dialog provider unmounts first (M5).
    logRejection(showAlert({type: 'error', message: t(noUserRow ? 'dataError.noUserDialog' : 'dataError.dialog')}));
  }, [hasError, noUserRow, showAlert, t]);

  return null;
};
