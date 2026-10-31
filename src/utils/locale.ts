import {getLocales} from 'react-native-localize';
import {createMmkvPreference, optionalString} from './mmkvPreference';

// getFormatLocale runs on every formatAmount (twice per list row), so the
// override is cached (S5, v2.7.1); setLocaleOverride is the only writer.
const localeOverride = createMmkvPreference('user_locale_override', optionalString, null);

interface DeviceLocaleInfo {
  languageTag: string;
  languageCode: string;
  countryCode: string;
  isRTL: boolean;
}

let cachedLocaleInfo: DeviceLocaleInfo | null = null;

/**
 * Returns the device's primary locale info from OS settings.
 * Cached per session — call invalidateLocaleCache() on AppState "active" if needed.
 */
export const getDeviceLocaleInfo = (): DeviceLocaleInfo => {
  if (cachedLocaleInfo) return cachedLocaleInfo;

  try {
    const [primary] = getLocales();
    if (primary) {
      cachedLocaleInfo = {
        languageTag: primary.languageTag,
        languageCode: primary.languageCode,
        countryCode: primary.countryCode ?? '',
        isRTL: primary.isRTL,
      };
      return cachedLocaleInfo;
    }
  } catch {
    // Native module failed — use safe fallback
  }

  cachedLocaleInfo = {
    languageTag: 'en-US',
    languageCode: 'en',
    countryCode: 'US',
    isRTL: false,
  };
  return cachedLocaleInfo;
};

/** Drops the cached device locale and the cached override; the next read goes to the OS and MMKV. @internal test */
export const invalidateLocaleCache = (): void => {
  cachedLocaleInfo = null;
  localeOverride.invalidate();
};

/**
 * Returns the locale to use for number/currency formatting.
 * Priority: user override (Settings) > device OS locale
 *
 * BCP-47 language tag (e.g., "en-US", "ru-RU", "hu-HU", "hi-IN")
 */
export const getFormatLocale = (): string => {
  return localeOverride.get() ?? getDeviceLocaleInfo().languageTag;
};

/**
 * Persists a locale override (null = follow the device) and returns the
 * language code to switch to. Applying it is src/i18n's job
 * (`applyLocaleOverride`), so this file stays free of i18next and dateUtils.
 */
export const setLocaleOverride = (locale: string | null): string => {
  localeOverride.set(locale);
  cachedLocaleInfo = null;
  return (locale && locale.split('-')[0]) || getDeviceLocaleInfo().languageCode;
};
