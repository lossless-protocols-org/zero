import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getFormatLocale, setLocaleOverride} from '../utils/locale';
import {setCalendarLabels, setDayjsLocale} from '../utils/dateUtils';
import en from './locales/en.json';

const resources = {
  en: {translation: en},
} as const;

// Dates follow the language: dayjs's month/weekday names and the
// Today/Yesterday labels move with every change, including the first one.
i18n.on('languageChanged', language => {
  setDayjsLocale(language);
  setCalendarLabels({
    today: i18n.t('calendar.today'),
    tomorrow: i18n.t('calendar.tomorrow'),
    yesterday: i18n.t('calendar.yesterday'),
    lastWeek: i18n.t('calendar.lastWeek'),
  });
});

// Bundled resources only (no backend), so init cannot reject.
void i18n.use(initReactI18next).init({
  resources,
  // Honour a persisted user override; initialising from the device locale
  // alone silently reverted the user's language choice on every cold start.
  lng: getFormatLocale().split('-')[0],
  fallbackLng: 'en',
  interpolation: {escapeValue: false},
  react: {useSuspense: false},
});

/** Saves the user's locale choice (null = device) and switches the app to it. */
export const applyLocaleOverride = (locale: string | null): void => {
  void i18n.changeLanguage(setLocaleOverride(locale));
};

export default i18n;
