import {useEffect} from 'react';
import {Linking} from 'react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {afterInteractions} from '../platform/afterInteractions';
import {getFirstSeenVersion} from '../platform/firstSeenVersion';
import {getAppVersion} from '../platform/getVersion';
import {navigate} from '../platform/navigationUtils';
import {proEndedNoticePreference, whatsNewSeenPreference} from '../platform/proNotices';
import {isPro} from '../pro/entitlement';
import {shouldShowWhatsNew} from '../pro/whatsNew';
import {useEntitlement} from '../ui/hooks/useEntitlement';
import {useAppliedPro} from '../ui/hooks/useProFeature';
import {useRecurringState} from '../ui/hooks/useRecurringState';
import {useDialog} from '../ui/context/DialogContext';
import {useTranslation} from 'react-i18next';

/** The behind rules already asked about in this run: the prompt is said once, not on every return. */
const askedAbout = new Set<string>();

/**
 * The things zero says about Pro without being asked (3.0), each once:
 *
 * - "What's new in 3.0", to an install that updated from before 3.0;
 * - "zero Pro has ended", once per ending, at the first safe point after it
 *   (the gate has applied the downgrade, so no Pro screen is open);
 * - recurring entries missed while the app was closed or Pro was off (P9):
 *   it only says so and offers to show them. Adding them or starting from
 *   today is a deliberate tap on the Recurring screen, so a stray tap on the
 *   dialog's backdrop can never add or skip anything.
 *
 * Each is recorded as said before it is shown: a crash or a kill in between
 * can cost the message, never repeat it. Renders nothing.
 */
export const ProAnnouncements = () => {
  const entitlement = useEntitlement();
  const applied = useAppliedPro();

  useEffect(() => {
    const due = shouldShowWhatsNew({
      firstSeenVersion: getFirstSeenVersion(),
      appVersion: getAppVersion(),
      seen: whatsNewSeenPreference.get(),
    });
    if (!due) {
      return undefined;
    }
    let cancelled = false;
    let waiting: {cancel: () => void} | undefined;
    const show = (): void => {
      if (cancelled) {
        return;
      }
      // After the first screen has drawn, so it opens over Home and Back returns there.
      waiting = afterInteractions(() => {
        whatsNewSeenPreference.set(true);
        navigate('WhatsNewScreen');
      });
    };
    // Not this time if a link opened the app (a widget tap, a quick add): the person came to do
    // something, and the screen would land on top of it. It is still due at the next plain launch.
    // If the system cannot say how the app was opened, it is shown.
    Linking.getInitialURL().then(url => (url === null ? show() : undefined), show);
    return () => {
      cancelled = true;
      waiting?.cancel();
    };
  }, []);

  const {endedAtMs, state} = entitlement;
  useEffect(() => {
    if (applied || isPro(state) || endedAtMs === null || proEndedNoticePreference.get() === endedAtMs) {
      return;
    }
    proEndedNoticePreference.set(endedAtMs);
    void SheetManager.show('pro-ended-sheet');
  }, [applied, endedAtMs, state]);

  const {behind} = useRecurringState();
  const {showDialog} = useDialog();
  const {t} = useTranslation();
  useEffect(() => {
    const fresh = behind.filter(rule => !askedAbout.has(`${rule.ruleId}:${rule.missed}`));
    if (!applied || fresh.length === 0) {
      return;
    }
    fresh.forEach(rule => askedAbout.add(`${rule.ruleId}:${rule.missed}`));
    void showDialog({
      type: 'info',
      message: t('recurring.missedPrompt'),
      okLabel: t('recurring.missedSee'),
      cancelLabel: t('recurring.missedLater'),
    }).then(see => (see ? navigate('RecurringScreen') : undefined));
  }, [applied, behind, showDialog, t]);

  return null;
};
