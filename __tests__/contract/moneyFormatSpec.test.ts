/**
 * The money rules handed to the iOS widget (2.8) reproduce
 * formatAmountWithSymbol exactly, for every grouping style and symbol side,
 * so a total the widget redoes natively reads the same as the app's.
 *
 * Every case is also pinned in contracts/money-format-cases.json, which the
 * Swift twin (ios/ZeroShared MoneyFormat) is tested against, so the two
 * formatters are held to the same answers (audit 2026-11-08 §6.1). After a
 * deliberate change: ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/moneyFormatSpec.test.ts
 */
import {formatAmountWithSymbol} from '../../src/platform/numberFormat';
import {formatWithMoneySpec, moneyFormatSpec} from '../../src/platform/moneyFormatSpec';
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const CASES_FILE = fromRoot('contracts', 'money-format-cases.json');

const CASES: Array<[string, string]> = [
  ['INR', 'en-IN'],
  ['USD', 'en-US'],
  ['EUR', 'de-DE'],
  ['EUR', 'fr-FR'],
  ['GBP', 'en-GB'],
  ['JPY', 'ja-JP'],
  ['KWD', 'ar-KW'],
  ['SEK', 'sv-SE'],
  ['BRL', 'pt-BR'],
  ['CHF', 'de-CH'],
];
const AMOUNTS = [0, 1, 7, 99.5, 120, 1234, 12_345.67, 45_029, 100_000, 1_234_567.25, 98_765_432];

describe.each(CASES)('%s in %s', (currency, locale) => {
  const spec = moneyFormatSpec(currency, locale);
  it.each(AMOUNTS)('%p reads the same as the app', amount => {
    expect(formatWithMoneySpec(spec, amount)).toBe(formatAmountWithSymbol(amount, currency, locale));
  });
});

it('reads Indian grouping as 3 then 2', () => {
  expect(moneyFormatSpec('INR', 'en-IN').grouping).toEqual([3, 2]);
  expect(moneyFormatSpec('USD', 'en-US').grouping).toEqual([3]);
});

it('pins every case for the Swift formatter (contracts/money-format-cases.json)', () => {
  const cases = CASES.flatMap(([currency, locale]) => {
    const spec = moneyFormatSpec(currency, locale);
    return AMOUNTS.map(amount => ({
      currency,
      locale,
      spec,
      amount,
      text: formatAmountWithSymbol(amount, currency, locale),
    }));
  });
  const json = `${JSON.stringify(cases, null, 2)}\n`;
  if (process.env['ZERO_UPDATE_CONTRACTS'] === '1') {
    fs.writeFileSync(CASES_FILE, json);
  }
  expect(fs.readFileSync(CASES_FILE, 'utf8')).toBe(json);
});
