/**
 * Money is added at a fixed scale of 10⁴ (R10, schema v5): every ISO 4217
 * exponent is 0–3, so each amount is an exact integer at this scale and the
 * sum carries no binary-float drift (0.1 + 0.2 is 0.3 here). The scale is
 * fixed rather than the currency's own because changing the currency
 * relabels rows without converting them. One amount is at most 10¹¹ major
 * units (validationSchema) = 10¹⁵ units; a total is exact up to 2⁵³ ≈ 9×10¹⁵.
 */
const MONEY_SCALE = 10_000;

/** An amount as an exact integer of 10⁻⁴ units, for adding and comparing money. */
export const toMoneyUnits = (amount: number): number => Math.round(amount * MONEY_SCALE);

export const fromMoneyUnits = (units: number): number => units / MONEY_SCALE;

/** Sum of the `amount` field of every row, without float drift. The only way money is added. */
export const sumAmounts = (rows: ReadonlyArray<{amount: number}>): number =>
  fromMoneyUnits(rows.reduce((sum, row) => sum + toMoneyUnits(row.amount), 0));
