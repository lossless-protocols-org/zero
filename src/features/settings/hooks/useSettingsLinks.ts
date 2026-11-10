import {useCallback, useMemo} from 'react';
import {Linking, Platform} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../../ui/context/DialogContext';
import {appendErrorLog} from '../../../platform/errorLog';
import {
  APP_STORE_REVIEW_URL,
  BUG_REPORT_URL,
  DISCORD_UPDATES_URL,
  GITHUB_REPO_URL,
  PLAY_STORE_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from '../../../constants/links';

/**
 * Settings' outbound links (every URL lives in constants/links). A device
 * with no browser used to fail silently: the failure is logged and said.
 */
export const useSettingsLinks = () => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();

  const open = useCallback(
    (url: string) => {
      Linking.openURL(url).catch(async (error: unknown) => {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('settings.linkFailed')});
      });
    },
    [showAlert, t],
  );

  return useMemo(
    () => ({
      reportBug: () => open(BUG_REPORT_URL),
      community: () => open(DISCORD_UPDATES_URL),
      rateApp: () => open(Platform.select({ios: APP_STORE_REVIEW_URL, default: PLAY_STORE_URL})),
      github: () => open(GITHUB_REPO_URL),
      privacyPolicy: () => open(PRIVACY_POLICY_URL),
      terms: () => open(TERMS_URL),
    }),
    [open],
  );
};
