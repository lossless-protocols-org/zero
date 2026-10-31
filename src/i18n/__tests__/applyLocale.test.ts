/**
 * M9 (v2.7.1): utils/locale.ts no longer reaches into i18next or dateUtils
 * (the cycle was papered over with require()). It persists the override and
 * returns the language; src/i18n applies it, and i18n's languageChanged
 * listener moves dayjs and the calendar labels along.
 */
import dayjs from 'dayjs';
import StorageService from '../../utils/storage';
import i18n, {applyLocaleOverride} from '..';
import {setLocaleOverride} from '../../utils/locale';
import {formatCalendar, formatDisplayDate} from '../../utils/dateUtils';

afterEach(() => {
  applyLocaleOverride(null);
});

it('setLocaleOverride only persists and returns the language code', () => {
  expect(setLocaleOverride('de-DE')).toBe('de');
  expect(StorageService.getItemSync('user_locale_override')).toBe('de-DE');
});

it('applyLocaleOverride switches i18next and dayjs together', async () => {
  applyLocaleOverride('de-DE');
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(i18n.language).toBe('de');
  expect(dayjs.locale()).toBe('de');
});

it('calendar labels come from the translations', () => {
  expect(formatCalendar(dayjs())).toBe('Today');
  // Older days use the locale's date (M32), not the English-only 'Do MMM YYYY'.
  expect(formatCalendar('2020-03-01')).toBe(formatDisplayDate('2020-03-01', 'date'));
  expect(formatCalendar('2020-03-01')).not.toContain('1st');
});
