/**
 * Money maths, as properties over generated amounts rather than a hand-picked
 * list (audit 2026-11-08 §7.6). Every amount the app stores has 0–3 decimals
 * (ISO 4217 exponents) and at most 10¹¹ major units (validationSchema); a
 * total stays exact while it is under 2⁵³ units. The expected sums are
 * computed independently, in BigInt, from the decimal digits.
 */
import fc from 'fast-check';
import {fromMoneyUnits, sumAmounts, toMoneyUnits} from '../../../src/domain/money';
import {budgetStatus} from '../../../src/domain/budgetMath';

/** An amount as the user typed it: `digits` scaled by 10^-decimals, kept with its exact value. */
const amount = (maxMajor: number) =>
  fc
    .record({
      decimals: fc.integer({min: 0, max: 3}),
      sign: fc.constantFrom(1, -1),
      seed: fc.double({min: 0, max: 1, noNaN: true}),
    })
    .map(({decimals, sign, seed}) => {
      const digits = Math.floor(seed * maxMajor * 10 ** decimals);
      return {
        value: (sign * digits) / 10 ** decimals,
        // The same amount in 10⁻⁴ units, exactly.
        units: BigInt(sign * digits) * 10n ** BigInt(4 - decimals),
      };
    });

it('an amount survives the trip to units and back exactly, as an integer in between', () => {
  fc.assert(
    fc.property(amount(1e11), ({value, units}) => {
      const toUnits = toMoneyUnits(value);
      expect(Number.isInteger(toUnits)).toBe(true);
      expect(BigInt(toUnits)).toBe(units);
      expect(fromMoneyUnits(toUnits)).toBe(value);
    }),
  );
});

it('a sum is the exact decimal sum, whatever the order of the rows', () => {
  // 100 rows of up to 10⁹ major units: the total stays under 2⁵³ units.
  const rowsAndAPermutation = fc
    .array(amount(1e9), {maxLength: 100})
    .chain(rows => fc.tuple(fc.constant(rows), fc.shuffledSubarray(rows, {minLength: rows.length})));
  fc.assert(
    fc.property(rowsAndAPermutation, ([rows, permuted]) => {
      const expected = Number(rows.reduce((sum, row) => sum + row.units, 0n)) / 10_000;
      expect(sumAmounts(rows.map(row => ({amount: row.value})))).toBe(expected);
      expect(sumAmounts(permuted.map(row => ({amount: row.value})))).toBe(expected);
    }),
  );
});

it('summing in parts gives the same total as summing at once', () => {
  fc.assert(
    fc.property(fc.array(amount(1e9), {maxLength: 50}), fc.array(amount(1e9), {maxLength: 50}), (a, b) => {
      const rows = (list: typeof a) => list.map(row => ({amount: row.value}));
      expect(sumAmounts([{amount: sumAmounts(rows(a))}, ...rows(b)])).toBe(sumAmounts([...rows(a), ...rows(b)]));
    }),
  );
});

it('the budget card: what is left and what is over always add back to budget − spent, exactly', () => {
  fc.assert(
    fc.property(
      amount(1e9).map(a => Math.abs(a.value)),
      amount(1e9).map(a => a.value),
      fc.integer({min: 1, max: 31}),
      (budget, spent, dayOfMonth) => {
        const status = budgetStatus({budget, spent, spentToday: 0, dayOfMonth, daysInMonth: 31, isCurrentMonth: true});
        expect(toMoneyUnits(status.left) - toMoneyUnits(status.over)).toBe(toMoneyUnits(budget) - toMoneyUnits(spent));
        expect(status.left >= 0 && status.over >= 0).toBe(true);
        expect(status.left === 0 || status.over === 0).toBe(true);
        expect(status.exceeded).toBe(toMoneyUnits(spent) > toMoneyUnits(budget));
        expect(status.fill).toBeGreaterThanOrEqual(0);
        expect(status.fill).toBeLessThanOrEqual(100);
      },
    ),
  );
});
