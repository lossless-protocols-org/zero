import {computeDailyAllowance} from '../../../src/domain/budgetMath';
import {budgetStatus} from '../../../src/domain/budgetMath';

describe('computeDailyAllowance — current month (adaptive)', () => {
  it("matches the owner's example: 30k/30d, 10k spent by day 3 → 20k over 28 days", () => {
    const {allowance, budgetExhausted} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 10000,
      dayOfMonth: 3,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBeCloseTo(20000 / 28, 6); // ≈ 714.29
    expect(budgetExhausted).toBe(false);
  });

  it('day 1 with nothing spent is the plain monthly average', () => {
    const {allowance} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 0,
      dayOfMonth: 1,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBeCloseTo(1000, 6);
  });

  it('under-spending raises the later daily allowance', () => {
    // 10 days gone, only 5k of 30k spent → 25k over 21 remaining days.
    const {allowance} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 5000,
      dayOfMonth: 10,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBeCloseTo(25000 / 21, 6); // ≈ 1190 > 1000
  });

  it('last day of the month gets everything that is left', () => {
    const {allowance} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 28000,
      dayOfMonth: 30,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBeCloseTo(2000, 6);
  });

  it('clamps to zero when the month is overspent — never negative', () => {
    const {allowance, budgetExhausted} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 35000,
      dayOfMonth: 20,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBe(0);
    expect(budgetExhausted).toBe(true);
  });

  it('flags exhausted when spend exactly equals the budget', () => {
    const {allowance, budgetExhausted} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 30000,
      dayOfMonth: 15,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBe(0);
    expect(budgetExhausted).toBe(true);
  });
});

describe('computeDailyAllowance — other months (static, back-compat)', () => {
  it('keeps the historical behaviour: budget / daysInMonth, spend ignored', () => {
    const {allowance, budgetExhausted} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 999999,
      dayOfMonth: 12,
      daysInMonth: 30,
      isCurrentMonth: false,
    });
    expect(allowance).toBeCloseTo(1000, 6);
    expect(budgetExhausted).toBe(false);
  });
});

describe('computeDailyAllowance — degenerate inputs never crash or go negative', () => {
  it('zero budget', () => {
    const result = computeDailyAllowance({
      monthlyBudget: 0,
      spentBeforeToday: 100,
      dayOfMonth: 5,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(result.allowance).toBe(0);
    expect(result.budgetExhausted).toBe(true);
  });

  it('zero daysInMonth', () => {
    const result = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 0,
      dayOfMonth: 1,
      daysInMonth: 0,
      isCurrentMonth: true,
    });
    expect(result.allowance).toBe(0);
  });

  it('dayOfMonth beyond daysInMonth still divides by at least one day', () => {
    const {allowance} = computeDailyAllowance({
      monthlyBudget: 30000,
      spentBeforeToday: 0,
      dayOfMonth: 31,
      daysInMonth: 30,
      isCurrentMonth: true,
    });
    expect(allowance).toBeCloseTo(30000, 6);
    expect(Number.isFinite(allowance)).toBe(true);
  });
});

describe('budgetStatus (Home and Reports, one rule, exact units)', () => {
  const base = {dayOfMonth: 10, daysInMonth: 30, isCurrentMonth: true};

  it('under budget: what is left, the percent, the bar and today’s allowance', () => {
    const s = budgetStatus({...base, budget: 3000, spent: 900, spentToday: 100});
    expect(s).toMatchObject({amount: 3000, exceeded: false, left: 2100, over: 0, percent: 30, fill: 30});
    // (3000 − 800 spent before today) over the 21 days from the 10th, less today's 100.
    expect(s.dailyBudget).toBeCloseTo(2200 / 21, 9);
    expect(s.dailyLeft).toBeCloseTo(2200 / 21 - 100, 4);
  });

  it('over budget: how far over, the bar full, the percent capped at 999', () => {
    expect(budgetStatus({...base, budget: 100, spent: 1500, spentToday: 0})).toMatchObject({
      exceeded: true,
      left: 0,
      over: 1400,
      fill: 100,
      percent: 999,
      dailyBudget: 0,
    });
  });

  it('adds money exactly: 0.1 + 0.2 of spending against a 0.3 budget is not over', () => {
    expect(budgetStatus({...base, budget: 0.3, spent: 0.1 + 0.2, spentToday: 0})).toMatchObject({
      exceeded: false,
      left: 0,
    });
  });
});
