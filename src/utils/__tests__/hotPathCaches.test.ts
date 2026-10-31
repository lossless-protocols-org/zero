/**
 * Characterization for S5 (v2.7.1): `formatAmount` runs twice per row and
 * every SwipeableRow renders the swipe preference, so neither may hit MMKV
 * per call. The locale override and the swipe preference are cached in
 * module state that only their setters write (they are the only writers of
 * those keys); `invalidateLocaleCache` drops the locale caches. Runs under
 * jest and bun; storage reads are counted by wrapping StorageService methods.
 */
import StorageService from '../storage';
import {getFormatLocale, invalidateLocaleCache, setLocaleOverride} from '../locale';
import {swipeActionsPreference} from '../swipeActions';
import {getNumberFormatter, type FormatterOptions} from '../numberUtils';

type ReadMethod = 'getItemSync' | 'getBoolean' | 'contains';

/** Counts calls to StorageService read methods while `fn` runs. */
const countReads = (methods: ReadMethod[], fn: () => void): number => {
  let reads = 0;
  const originals = methods.map(m => [m, StorageService[m]] as const);
  for (const [name, original] of originals) {
    const forward: (key: string) => unknown = original.bind(StorageService);
    // Each wrapper forwards to the method it replaced, so the signature is unchanged.
    (StorageService as Record<ReadMethod, (key: string) => unknown>)[name] = (key: string) => {
      reads++;
      return forward(key);
    };
  }
  try {
    fn();
  } finally {
    for (const [name, original] of originals) {
      (StorageService as Record<ReadMethod, unknown>)[name] = original; // restoring the exact method saved above
    }
  }
  return reads;
};

const LOCALE_OVERRIDE_KEY = 'user_locale_override';

afterEach(() => {
  setLocaleOverride(null);
  invalidateLocaleCache();
});

describe('locale override cache', () => {
  it('reads MMKV at most once across many format calls', () => {
    invalidateLocaleCache();
    const reads = countReads(['getItemSync'], () => {
      for (let i = 0; i < 100; i++) {
        getFormatLocale();
      }
    });
    expect(reads).toBeLessThanOrEqual(1);
  });

  it('follows setLocaleOverride immediately, including reset to the device locale', () => {
    const device = getFormatLocale();
    setLocaleOverride('de-DE');
    expect(getFormatLocale()).toBe('de-DE');
    setLocaleOverride(null);
    expect(getFormatLocale()).toBe(device);
  });

  it('invalidateLocaleCache drops the cached override so a direct MMKV write is seen', () => {
    setLocaleOverride('de-DE');
    expect(getFormatLocale()).toBe('de-DE');
    StorageService.setItemSync(LOCALE_OVERRIDE_KEY, 'fr-FR');
    invalidateLocaleCache();
    expect(getFormatLocale()).toBe('fr-FR');
    StorageService.removeItemSync(LOCALE_OVERRIDE_KEY);
    invalidateLocaleCache();
    expect(getFormatLocale()).not.toBe('fr-FR');
  });
});

describe('swipe preference cache', () => {
  it('reads MMKV at most once across many renders', () => {
    swipeActionsPreference.set(true); // warm path: the cold first read is covered by the round-trip test in swipeActions.test.ts
    const reads = countReads(['getBoolean', 'contains'], () => {
      for (let i = 0; i < 100; i++) {
        swipeActionsPreference.get();
      }
    });
    expect(reads).toBeLessThanOrEqual(1);
  });

  it('the setter updates the cached value and storage', () => {
    swipeActionsPreference.set(false);
    expect(swipeActionsPreference.get()).toBe(false);
    expect(StorageService.getBoolean('swipeActionsEnabled')).toBe(false);
    swipeActionsPreference.set(true);
    expect(swipeActionsPreference.get()).toBe(true);
  });
});

describe('number formatter cache key', () => {
  const base: FormatterOptions = {minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true};

  it('returns the same formatter for the same locale and options', () => {
    expect(getNumberFormatter('en-US', {...base})).toBe(getNumberFormatter('en-US', {...base}));
  });

  it('returns a different formatter when any option or the locale differs', () => {
    const reference = getNumberFormatter('en-US', base);
    const variants: Array<[string, FormatterOptions]> = [
      ['en-IN', base],
      ['en-US', {...base, minimumFractionDigits: 1}],
      ['en-US', {...base, maximumFractionDigits: 3}],
      ['en-US', {...base, useGrouping: false}],
      [
        'en-US',
        {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        },
      ],
      [
        'en-US',
        {
          style: 'currency',
          currency: 'EUR',
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        },
      ],
      [
        'en-US',
        {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'symbol',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        },
      ],
      ['en-US', {notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1}],
      ['en-US', {notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 1}],
    ];
    const seen = new Set<Intl.NumberFormat>([reference]);
    for (const [locale, options] of variants) {
      const formatter = getNumberFormatter(locale, options);
      expect(seen.has(formatter)).toBe(false);
      seen.add(formatter);
    }
  });
});
