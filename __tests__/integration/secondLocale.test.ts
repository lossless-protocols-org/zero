/**
 * The translation plumbing, run against languages other than English (audit
 * 2026-11-08 §9: only en.json exists, so plurals, placeholders and date names
 * had never run in another language). Pseudo-translations made from en.json
 * stand in for real ones: every string wrapped in ⟪ ⟫, placeholders kept, and
 * Arabic given all six plural forms, each marked. Checked:
 *
 * - a language change reaches dayjs (month names) and the calendar labels;
 * - placeholders land inside the translated sentence, wherever it puts them;
 * - plural forms follow the language's own rules (Arabic: zero, one, two,
 *   few, many, other);
 * - every English sentence with a count has its plural forms, and every
 *   plural form has a count.
 */
import {i18n} from '../../src/i18n';
import en from '../../src/i18n/locales/en.json';
import {formatCalendar, getMonthNames} from '../../src/platform/dateFormat';

type Tree = {[key: string]: string | Tree};

const pseudo = (tree: Tree, extraPlurals: readonly string[] = []): Tree =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]): Array<[string, string | Tree]> => {
      if (typeof value !== 'string') {
        return [[key, pseudo(value, extraPlurals)]];
      }
      const entry: [string, string] = [key, `⟪${value}⟫`];
      if (!key.endsWith('_other')) {
        return [entry];
      }
      const base = key.slice(0, -'_other'.length);
      // Languages with more plural forms than English: each extra form, marked, from "other".
      return [entry, ...extraPlurals.map((form): [string, string] => [`${base}_${form}`, `⟪${form}: ${value}⟫`])];
    }),
  );

const leaves = (tree: Tree, prefix = ''): Array<[string, string]> =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[prefix + key, value]] : leaves(value, `${prefix}${key}.`),
  );

beforeAll(() => {
  i18n.addResourceBundle('de', 'translation', pseudo(en));
  i18n.addResourceBundle('ar', 'translation', pseudo(en, ['zero', 'two', 'few', 'many']));
});
afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('German', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('de');
  });

  it('puts the amount inside the translated sentence', () => {
    expect(i18n.t('home.amountLeft', {amount: '400 €'})).toBe('⟪400 € left⟫');
    expect(i18n.t('home.todayAmount', {amount: '12 €'})).toBe('⟪Today: 12 €⟫');
  });

  it('picks the plural form by count', () => {
    expect(i18n.t('home.transactionCount', {count: 1})).toBe('⟪1 transaction⟫');
    expect(i18n.t('home.transactionCount', {count: 5})).toBe('⟪5 transactions⟫');
  });

  it('switches dayjs and the calendar labels with it', () => {
    expect(getMonthNames()[0]).toBe('Januar');
    expect(formatCalendar(new Date())).toBe('⟪Today⟫');
  });
});

describe('Arabic', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ar');
  });

  it.each([
    [0, 'zero'],
    [2, 'two'],
    [3, 'few'],
    [11, 'many'],
  ])('a count of %d takes the "%s" form', (count, form) => {
    expect(i18n.t('home.transactionCount', {count})).toBe(`⟪${form}: ${count} transactions⟫`);
  });

  it('a count of 1 takes the "one" form, and 100 "other"', () => {
    expect(i18n.t('home.transactionCount', {count: 1})).toBe('⟪1 transaction⟫');
    expect(i18n.t('home.transactionCount', {count: 100})).toBe('⟪100 transactions⟫');
  });

  it('switches dayjs to Arabic month names', () => {
    expect(getMonthNames()[0]).toBe('يناير');
  });
});

describe('en.json', () => {
  const all = leaves(en);
  const keys = new Set(all.map(([key]) => key));

  it('every sentence with a count has "one" and "other" forms', () => {
    const missing = all
      .filter(([key, value]) => value.includes('{{count}}') && !/_(one|other)$/.test(key))
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('every plural form has its pair and a count in it', () => {
    const broken = all
      .filter(([key]) => /_(one|other)$/.test(key))
      .filter(([key, value]) => {
        const base = key.replace(/_(one|other)$/, '');
        return (
          !keys.has(`${base}_one`) ||
          !keys.has(`${base}_other`) ||
          (key.endsWith('_other') && !value.includes('{{count}}'))
        );
      })
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });
});
