/**
 * react-i18next for suites that assert on copy KEYS rather than English text,
 * so a wording change never breaks a test. One definition for what fourteen
 * suites each wrote inline (audit 2026-11-08 §7.5):
 *
 *   jest.mock('react-i18next', () => require('<…>/harness/mocks/reactI18next'));
 *
 * `t(key)` returns the key, or the text a suite set with
 * `setMockTranslations` (a localized default-category name, say), with its
 * `{{placeholders}}` filled from the options as i18next fills them: a suite
 * that checks a figure lands in its sentence sets the sentence. Suites that
 * check real English or locale behaviour use the real i18next instead.
 */
const translations = new Map<string, string>();

/** Replaces the translations `t` returns; keys not listed come back unchanged. */
export const setMockTranslations = (entries: Record<string, string>): void => {
  translations.clear();
  for (const [key, text] of Object.entries(entries)) {
    translations.set(key, text);
  }
};

const t = (key: string, options: Record<string, unknown> = {}): string => {
  const text = translations.get(key);
  return text === undefined
    ? key
    : text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in options ? String(options[name]) : whole));
};

export const useTranslation = () => ({t, i18n: {language: 'en'}});

/** What src/i18n registers with i18next at import (validationSchema pulls it in). */
export const initReactI18next = {type: '3rdParty', init: (): void => undefined};
