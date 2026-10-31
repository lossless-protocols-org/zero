import {useEffect, useRef} from 'react';
import {Share} from 'react-native';
import {afterInteractions} from '../../utils/afterInteractions';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../context/DialogContext';
import {
  formatErrorReport,
  getErrorLog,
  getLastCrashPromptedAt,
  getLastPromptedMessage,
  getUnreportedFatal,
  setLastCrashPromptedAt,
  setLastPromptedMessage,
} from '../../utils/errorLog';
import {getReportMeta} from '../../utils/reportMeta';

/**
 * Asks, once per crash, whether the user wants to share the previous launch's
 * fatal error. Renders nothing.
 *
 * Why this exists: zero has no crash reporter (Lossless R1/R3), and Play
 * Console redacts the message of every React Native JS crash. In Sept–Oct 2026
 * a one-line bug crashed 706 users for seven weeks and the only way its message
 * was ever recovered was from one phone's system DropBox. The app had the
 * message the whole time, in the on-device error log that Settings →
 * Diagnostics shows — a screen nobody is told to open after a crash.
 *
 * Nothing leaves the device unless the user taps Share, and then only through
 * the system share sheet to a destination they pick. The report is the error
 * text, minified code locations, app version and device model: no financial
 * data, no names, no identifiers.
 */
const CrashReportPrompt = () => {
  const {showDialog} = useDialog();
  const {t} = useTranslation();
  const askedRef = useRef(false);

  useEffect(() => {
    if (askedRef.current) {
      return;
    }
    askedRef.current = true;

    const entries = getErrorLog();
    const lastPromptedAt = getLastCrashPromptedAt();
    const fatal = getUnreportedFatal(entries, lastPromptedAt);
    if (!fatal) {
      return;
    }
    // Whatever the user chooses, this entry is never asked about again.
    setLastCrashPromptedAt(fatal.timestamp);
    // A crash since the last prompt decides the wording, even if a background
    // error happened after it.
    const crashed = entries.some(e => e.fatal && (!lastPromptedAt || e.timestamp > lastPromptedAt));
    // A non-fatal error that repeats every session is asked about once, not every launch.
    if (!crashed && getLastPromptedMessage() === fatal.message) {
      return;
    }
    setLastPromptedMessage(fatal.message);

    // Let the first screen settle so the dialog doesn't fight the splash.
    const task = afterInteractions(() => {
      void (async () => {
        const wantsToShare = await showDialog({
          type: 'warning',
          // An unhandled rejection did not close the app; say what actually happened.
          message: t(crashed ? 'crashReport.message' : 'crashReport.unhandledMessage'),
          okLabel: t('crashReport.share'),
          cancelLabel: t('crashReport.notNow'),
        });
        if (!wantsToShare) {
          return;
        }
        const report = formatErrorReport(entries, getReportMeta());
        try {
          await Share.share({message: report, title: t('crashReport.shareTitle')});
        } catch {
          // A dismissed or failed share sheet needs no handling; the log stays.
        }
      })();
    });
    return () => task.cancel();
  }, [showDialog, t]);

  return null;
};

export default CrashReportPrompt;
