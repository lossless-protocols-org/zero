/**
 * Unit tests for numberUtils currency formatting. Runs under BOTH runners:
 * `bun run test` (jest) and `bun test` — react-native-localize/mmkv are
 * mocked to src/testing/* by jest.setup.js and bun-preload.ts respectively.
 *
 * Tests the core Intl.NumberFormat behavior and the locale-selection logic
 * without requiring React Native runtime.
 */

import {setMockLocales, resetLocalizeMock} from '../../testing/localizeMock';
import {invalidateLocaleCache} from '../locale';
import {formatCurrency, formatAmountWithSymbol, getCurrencyDecimals} from '../numberUtils';

// These tests exercise the lakh/crore guard, which only activates on a South
// Asian device locale — switch the mocked device to en-IN for this file.
beforeAll(() => {
  setMockLocales([{languageTag: 'en-IN', languageCode: 'en', countryCode: 'IN', isRTL: false}]);
  invalidateLocaleCache();
});

afterAll(() => {
  resetLocalizeMock();
  invalidateLocaleCache();
});

describe('formatCurrency — device locale en-IN', () => {
  describe('INR should use lakh/crore grouping', () => {
    it('124,000 → 1,24,000', () => {
      const result = formatCurrency(124000, 'INR');
      expect(result).toBe('1,24,000');
    });

    it('1,150,000 → 11,50,000', () => {
      const result = formatCurrency(1150000, 'INR');
      expect(result).toBe('11,50,000');
    });

    it('5,000,000 → 50,00,000', () => {
      const result = formatCurrency(5000000, 'INR');
      expect(result).toBe('50,00,000');
    });

    it('15,000,000 → 1,50,00,000', () => {
      const result = formatCurrency(15000000, 'INR');
      expect(result).toBe('1,50,00,000');
    });
  });

  describe('Non-lakh currencies MUST use international grouping (groups of 3)', () => {
    it('RUB 124,000 — NOT 1,24,000', () => {
      const result = formatCurrency(124000, 'RUB');
      expect(result).toBe('124,000');
      expect(result).not.toContain('1,24');
    });

    it('HUF 1,150,000 — NOT 11,50,000', () => {
      const result = formatCurrency(1150000, 'HUF');
      expect(result).toBe('1,150,000');
      expect(result).not.toContain('11,50');
    });

    it('TRY 124,000 — NOT 1,24,000', () => {
      const result = formatCurrency(124000, 'TRY');
      expect(result).toBe('124,000');
    });

    it('AED 1,500,000 — NOT 15,00,000', () => {
      const result = formatCurrency(1500000, 'AED');
      expect(result).toBe('1,500,000');
    });

    it('BHD 124,000.000 — NOT 1,24,000', () => {
      const result = formatCurrency(124000, 'BHD');
      expect(result).toBe('124,000.000');
    });

    it('USD 124,000 — NOT 1,24,000', () => {
      const result = formatCurrency(124000, 'USD');
      expect(result).toBe('124,000');
    });

    it('EUR 1,150,000 — NOT 11,50,000', () => {
      const result = formatCurrency(1150000, 'EUR');
      expect(result).toBe('1,150,000');
    });

    it('GBP 5,000,000 — NOT 50,00,000', () => {
      const result = formatCurrency(5000000, 'GBP');
      expect(result).toBe('5,000,000');
    });

    it('JPY 124,000 — NOT 1,24,000', () => {
      const result = formatCurrency(124000, 'JPY');
      expect(result).toBe('124,000');
    });

    it('KRW 1,250,000 — NOT 12,50,000', () => {
      const result = formatCurrency(1250000, 'KRW');
      expect(result).toBe('1,250,000');
    });

    it('VND 500,000,000 — NOT 50,00,00,000', () => {
      const result = formatCurrency(500000000, 'VND');
      expect(result).toBe('500,000,000');
    });
  });

  describe('Other lakh currencies SHOULD use lakh grouping', () => {
    it('BDT 124,000 → 1,24,000', () => {
      const result = formatCurrency(124000, 'BDT');
      expect(result).toBe('1,24,000');
    });

    it('NPR 1,150,000 → 11,50,000', () => {
      const result = formatCurrency(1150000, 'NPR');
      expect(result).toBe('11,50,000');
    });

    it('LKR 5,000,000 → 50,00,000', () => {
      const result = formatCurrency(5000000, 'LKR');
      expect(result).toBe('50,00,000');
    });
  });
});

describe('formatAmountWithSymbol — device locale en-IN', () => {
  describe('INR keeps lakh grouping with ₹ prefix', () => {
    it('₹1,24,000', () => {
      const result = formatAmountWithSymbol(124000, 'INR');
      expect(result).toBe('₹1,24,000');
    });

    it('₹11,50,000', () => {
      const result = formatAmountWithSymbol(1150000, 'INR');
      expect(result).toBe('₹11,50,000');
    });
  });

  describe('Non-lakh currencies use international grouping', () => {
    it('USD: $124,000', () => {
      const result = formatAmountWithSymbol(124000, 'USD');
      expect(result).toBe('$124,000');
    });

    it('RUB: ₽124,000', () => {
      const result = formatAmountWithSymbol(124000, 'RUB');
      expect(result.replace(/\s/g, '')).toContain('124,000');
      expect(result).not.toContain('1,24,000');
    });

    it('TRY: ₺124,000', () => {
      const result = formatAmountWithSymbol(124000, 'TRY');
      expect(result).toContain('124,000');
      expect(result).not.toContain('1,24,000');
    });

    it('AED: 1,500,000 NOT 15,00,000', () => {
      const result = formatAmountWithSymbol(1500000, 'AED');
      expect(result).toContain('1,500,000');
      expect(result).not.toContain('15,00,000');
    });

    it('BHD: 124,000 NOT 1,24,000', () => {
      const result = formatAmountWithSymbol(124000, 'BHD');
      expect(result).toContain('124,000');
      expect(result).not.toContain('1,24,000');
    });

    it('HUF: 1,150,000 NOT 11,50,000', () => {
      const result = formatAmountWithSymbol(1150000, 'HUF');
      expect(result).toContain('1,150,000');
      expect(result).not.toContain('11,50,000');
    });

    it('EUR: €124,000', () => {
      const result = formatAmountWithSymbol(124000, 'EUR');
      expect(result).toBe('€124,000');
    });

    it('GBP: £124,000', () => {
      const result = formatAmountWithSymbol(124000, 'GBP');
      expect(result).toBe('£124,000');
    });

    it('JPY: ¥124,000 (zero decimals)', () => {
      const result = formatAmountWithSymbol(124000, 'JPY');
      expect(result).toBe('¥124,000');
    });
  });

  describe('Decimal precision per currency', () => {
    it('BHD shows 3 decimals for fractional: 1,250.500', () => {
      const result = formatAmountWithSymbol(1250.5, 'BHD');
      expect(result).toContain('1,250.500');
    });

    it('KWD shows 3 decimals for fractional: 3,750.750', () => {
      const result = formatAmountWithSymbol(3750.75, 'KWD');
      expect(result).toContain('3,750.750');
    });

    it('JPY shows 0 decimals: ¥350', () => {
      const result = formatAmountWithSymbol(350, 'JPY');
      expect(result).toBe('¥350');
      expect(result).not.toContain('.');
    });

    it('HUF shows 0 decimals: Ft 115,000', () => {
      const result = formatAmountWithSymbol(115000, 'HUF');
      expect(result).not.toContain('.');
      expect(result).toContain('115,000');
    });

    it('USD whole number omits decimals: $124,000', () => {
      const result = formatAmountWithSymbol(124000, 'USD');
      expect(result).toBe('$124,000');
    });

    it('USD fractional shows 2 decimals: $18.75', () => {
      const result = formatAmountWithSymbol(18.75, 'USD');
      expect(result).toBe('$18.75');
    });
  });
});

describe('getCurrencyDecimals', () => {
  it('JPY → 0', () => expect(getCurrencyDecimals('JPY')).toBe(0));
  it('KRW → 0', () => expect(getCurrencyDecimals('KRW')).toBe(0));
  it('HUF → 0', () => expect(getCurrencyDecimals('HUF')).toBe(0));
  it('VND → 0', () => expect(getCurrencyDecimals('VND')).toBe(0));
  it('BHD → 3', () => expect(getCurrencyDecimals('BHD')).toBe(3));
  it('KWD → 3', () => expect(getCurrencyDecimals('KWD')).toBe(3));
  it('OMR → 3', () => expect(getCurrencyDecimals('OMR')).toBe(3));
  it('USD → 2', () => expect(getCurrencyDecimals('USD')).toBe(2));
  it('EUR → 2', () => expect(getCurrencyDecimals('EUR')).toBe(2));
  it('INR → 2', () => expect(getCurrencyDecimals('INR')).toBe(2));
  it('unknown → 2', () => expect(getCurrencyDecimals('XYZ')).toBe(2));
});

describe('Non-English Indian locales also get fixed (hi, bn, ta, mr, pa)', () => {
  it('hi-IN device: TRY should NOT use lakh (proves en-US fallback needed)', () => {
    // hi-US still gives lakh — so our fix must use en-US, not hi-US
    const hiUS = new Intl.NumberFormat('hi-US', {
      style: 'currency',
      currency: 'TRY',
      currencyDisplay: 'narrowSymbol',
    }).format(124000);
    const enUS = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'TRY',
      currencyDisplay: 'narrowSymbol',
    }).format(124000);

    // hi-US still has lakh grouping (bug in langCode-US approach)
    expect(hiUS).toContain('1,24,000');
    // en-US gives correct international grouping
    expect(enUS).toContain('124,000');
  });

  it('bn-BD device: AED should NOT use lakh (proves en-US fallback needed)', () => {
    const bnUS = new Intl.NumberFormat('bn-US', {
      style: 'currency',
      currency: 'AED',
      currencyDisplay: 'narrowSymbol',
    }).format(1500000);
    const enUS = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED',
      currencyDisplay: 'narrowSymbol',
    }).format(1500000);

    // Some ICU builds render bn-US with Bengali numerals; normalize so the
    // assertion checks the lakh GROUPING, not the digit script.
    const latinBnUS = bnUS.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
    expect(latinBnUS).toContain('15,00,000');
    expect(enUS).toContain('1,500,000');
  });
});

describe('Explicit locale override (bypasses device detection)', () => {
  it('en-IN explicitly still gives lakh for any currency', () => {
    const result = formatCurrency(124000, 'BHD', 'en-IN');
    expect(result).toBe('1,24,000.000');
  });

  it('en-US explicitly gives international grouping', () => {
    const result = formatCurrency(124000, 'BHD', 'en-US');
    expect(result).toBe('124,000.000');
  });

  it('de-DE gives dot grouping', () => {
    const result = formatCurrency(124000, 'EUR', 'de-DE');
    expect(result).toBe('124.000');
  });

  it('ru-RU gives space grouping', () => {
    const result = formatCurrency(124000, 'RUB', 'ru-RU');
    expect(result.replace(/\s/g, ' ')).toBe('124 000');
  });
});

describe('isCurrencySymbolSuffix', () => {
  const {isCurrencySymbolSuffix} = require('../numberUtils');

  it('prefix currencies report false', () => {
    expect(isCurrencySymbolSuffix('USD', 'en-US')).toBe(false);
    expect(isCurrencySymbolSuffix('INR', 'en-IN')).toBe(false);
  });

  it('suffix currencies report true', () => {
    expect(isCurrencySymbolSuffix('EUR', 'de-DE')).toBe(true);
    expect(isCurrencySymbolSuffix('SEK', 'sv-SE')).toBe(true);
    expect(isCurrencySymbolSuffix('RUB', 'ru-RU')).toBe(true);
  });

  it('matches formatAmountWithSymbol placement for the same inputs', () => {
    // The input and the display must always agree — that is the whole point.
    for (const [code, locale] of [
      ['USD', 'en-US'],
      ['EUR', 'de-DE'],
      ['SEK', 'sv-SE'],
    ] as const) {
      const formatted = formatAmountWithSymbol(1234, code, locale);
      const startsWithDigit = /^\d/.test(formatted);
      expect(isCurrencySymbolSuffix(code, locale)).toBe(startsWithDigit);
    }
  });

  it('falls back to prefix (false) instead of crashing on garbage input', () => {
    expect(isCurrencySymbolSuffix('NOT_A_CURRENCY', 'en-US')).toBe(false);
    expect(isCurrencySymbolSuffix(undefined)).toBe(false);
    expect(isCurrencySymbolSuffix('')).toBe(false);
  });
});
