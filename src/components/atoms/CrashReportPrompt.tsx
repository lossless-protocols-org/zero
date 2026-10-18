import {useEffect, useRef} from 'react';
import {InteractionManager, Platform, Share} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../context/DialogContext';
import {
  formatErrorReport,
  getErrorLog,
  getLastCrashPromptedAt,
  getUnreportedFatal,
  setLastCrashPromptedAt,
} from '../../utils/errorLog';
import {getAppVersion} from '../../utils/getVersion';

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
    const fatal = getUnreportedFatal(entries, getLastCrashPromptedAt());
    if (!fatal) {
      return;
    }
    // Whatever the user chooses, this crash is never asked about again.
    setLastCrashPromptedAt(fatal.timestamp);

    // Let the first screen settle so the dialog doesn't fight the splash.
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const wantsToShare = await showDialog({
          type: 'warning',
          message: t('crashReport.message'),
          okLabel: t('crashReport.share'),
          cancelLabel: t('crashReport.notNow'),
        });
        if (!wantsToShare) {
          return;
        }
        const constants = Platform.constants as {Brand?: string; Model?: string; Release?: string};
        const report = formatErrorReport(entries, {
          appVersion: getAppVersion(),
          os: Platform.OS,
          osVersion: constants.Release ?? String(Platform.Version),
          brand: constants.Brand,
          model: constants.Model,
        });
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
