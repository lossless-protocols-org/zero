interface Searchable {
  code: string;
  name: string;
  symbol: string;
}

/** Currencies whose code, name or symbol contains `query` (case-insensitive). */
export const filterCurrencies = <T extends Searchable>(currencies: T[], query: string): T[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return currencies;
  }
  return currencies.filter(
    ({code, name, symbol}) =>
      code.toLowerCase().includes(needle) ||
      name.toLowerCase().includes(needle) ||
      symbol.toLowerCase().includes(needle),
  );
};
