import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {appendErrorLog} from '../../../platform/errorLog';
import {shareReportPdf, type ReportDoc} from '../../../pro/reportPdf';
import {useDialog} from '../../../ui/context/DialogContext';

/**
 * "Share as PDF" (3.0, plan P12; Pro key `reports`): draws the document the
 * screen built and offers it through the system share sheet. One at a time;
 * a failure is logged and said, and nothing is left half-made (the native
 * side replaces the last report in the app's cache).
 */
export const useSharePdf = () => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const [sharing, setSharing] = useState(false);
  // Read before anything is awaited: two taps in one frame both see the state from before either.
  const busy = useRef(false);

  const share = useCallback(
    async (build: () => ReportDoc, name: string): Promise<void> => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      setSharing(true);
      try {
        await shareReportPdf(build(), name);
      } catch (error) {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('reports.pdfFailed')});
      } finally {
        busy.current = false;
        setSharing(false);
      }
    },
    [showAlert, t],
  );

  return {share, sharing};
};
