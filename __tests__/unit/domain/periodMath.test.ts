/**
 * R2 (2.8): the one place a refund changes sign. Runs under jest and bun.
 */
import {keptOf, netSpent, refundableRemainder, toSpendRows} from '../../../src/domain/periodMath';
import {sumAmounts} from '../../../src/domain/money';
import {moveInOrder} from '../../../src/domain/categoryOrder';
import {splitForAllowance} from '../../../src/domain/periodMath';

describe('periodMath', () => {
  it('turns refunds into negative spend rows and leaves expenses alone', () => {
    const rows = toSpendRows(
      [{id: 'e', amount: 3000, date: '2026-11-10'}],
      [{id: 'r', amount: 1200, date: '2026-11-20'}],
    );
    expect(rows.map(r => [r.id, r.amount])).toEqual([
      ['e', 3000],
      ['r', -1200],
    ]);
    // Any ordinary sum over them is net spending.
    expect(sumAmounts(rows)).toBe(1800);
  });

  it('nets exactly', () => {
    expect(netSpent([{amount: 0.3}], [{amount: 0.1}, {amount: 0.2}])).toBe(0);
    expect(netSpent([{amount: 0.1}, {amount: 0.2}], [])).toBe(0.3);
    expect(netSpent([], [{amount: 5}])).toBe(-5);
  });

  it('knows what is left to refund, never below zero', () => {
    expect(refundableRemainder(3000, 1200)).toBe(1800);
    expect(refundableRemainder(0.3, 0.1)).toBe(0.2);
    expect(refundableRemainder(10, 10)).toBe(0);
    expect(refundableRemainder(10, 11)).toBe(0);
  });

  it('kept is received minus spent, exact, and may be negative', () => {
    expect(keptOf(58000, 6720)).toBe(51280);
    expect(keptOf(0.3, 0.1)).toBe(0.2);
    expect(keptOf(100, 250)).toBe(-150);
  });
});

describe('moveInOrder (category reorder)', () => {
  const rows = [
    {id: 'a', active: true},
    {id: 'x', active: false},
    {id: 'b', active: true},
    {id: 'c', active: true},
  ];

  it('moves up and down past archived categories, which keep their slots', () => {
    expect(moveInOrder(rows, 'b', 'up')).toEqual(['b', 'x', 'a', 'c']);
    expect(moveInOrder(rows, 'a', 'down')).toEqual(['b', 'x', 'a', 'c']);
    expect(moveInOrder(rows, 'c', 'up')).toEqual(['a', 'x', 'c', 'b']);
  });

  it('moves to the top, before every other', () => {
    expect(moveInOrder(rows, 'c', 'top')).toEqual(['c', 'a', 'x', 'b']);
  });

  it('returns null when nothing changes or the id is unknown or archived', () => {
    expect(moveInOrder(rows, 'a', 'up')).toBeNull();
    expect(moveInOrder(rows, 'a', 'top')).toBeNull();
    expect(moveInOrder(rows, 'c', 'down')).toBeNull();
    expect(moveInOrder(rows, 'zzz', 'up')).toBeNull();
    expect(moveInOrder(rows, 'x', 'up')).toBeNull();
  });
});

describe('splitForAllowance', () => {
  it('passes ordinary days through', () => {
    expect(splitForAllowance(45029, 500)).toEqual({spentBeforeToday: 44529, spentToday: 500});
  });
  it('a refund-only day is no spend today and lowers the spending before it', () => {
    expect(splitForAllowance(44029, -1000)).toEqual({spentBeforeToday: 44029, spentToday: 0});
  });
});
