import {filterCurrencies} from '../currencySearch';

const list = [
  {code: 'INR', name: 'Indian Rupee', symbol: '₹'},
  {code: 'USD', name: 'US Dollar', symbol: '$'},
  {code: 'EUR', name: 'Euro', symbol: '€'},
];

describe('filterCurrencies (M12: one filter for the onboarding grid and the Settings sheet)', () => {
  it('returns the list unchanged for an empty or blank query', () => {
    expect(filterCurrencies(list, '')).toBe(list);
    expect(filterCurrencies(list, '   ')).toBe(list);
  });

  it('matches code, name or symbol, ignoring case and surrounding spaces', () => {
    expect(filterCurrencies(list, 'usd').map(c => c.code)).toEqual(['USD']);
    expect(filterCurrencies(list, ' rupee ').map(c => c.code)).toEqual(['INR']);
    expect(filterCurrencies(list, '€').map(c => c.code)).toEqual(['EUR']);
    expect(filterCurrencies(list, 'u').map(c => c.code)).toEqual(['INR', 'USD', 'EUR']);
  });
});
