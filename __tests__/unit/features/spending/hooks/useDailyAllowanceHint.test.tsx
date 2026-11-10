/**
 * A failed read shows nothing, never a confident wrong number (audit
 * 2026-11-08 §3.12): the daily-allowance hint used to say the whole daily
 * budget was "left today" when the month's spending could not be read.
 */
import {renderHook} from '@testing-library/react-native';
import {useDailyAllowanceHint} from '../../../../../src/features/spending/hooks/useDailyAllowanceHint';

const mockRead: {fail: boolean} = {fail: false};
jest.mock('../../../../../src/store/hooks', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: (select: (s: unknown) => unknown) => select(undefined),
}));
jest.mock('../../../../../src/store/slices/userIdSlice', () => ({selectUserId: () => 'u1'}));
jest.mock('../../../../../src/store/slices/budgetDataSlice', () => ({
  fetchBudgetsByMonth: jest.fn(),
  selectCurrentBudget: () => ({amount: 3000}),
}));
const mockSpend: {spentOnDay: number; spentBeforeDay: number} = {spentOnDay: 40, spentBeforeDay: 0};
jest.mock('../../../../../src/data/services/periodSummaryService', () => ({
  getAllowanceSpend: () =>
    mockRead.fail ? Promise.reject(new Error('database is locked')) : Promise.resolve({...mockSpend}),
}));
jest.mock('../../../../../src/platform/errorLog', () => ({appendErrorLog: jest.fn()}));

const hintFor = async (original?: {amount: number; date: string}) =>
  (await renderHook(() => useDailyAllowanceHint({createdAt: '2025-11-08T10:00:00', amount: '10', original}))).result
    .current;

describe('daily-allowance hint', () => {
  it('shows the figure once the month is read', async () => {
    mockRead.fail = false;
    const hint = await hintFor();
    expect(hint).not.toBeNull();
    // A past month, so the plain average: 3000 over 30 days = 100 a day; 40 already spent that day, 10 typed.
    expect(hint?.dailyBudget).toBe(100);
    expect(hint?.dailyRemaining).toBe(50);
  });

  it('editing a row of the same day does not count its stored amount twice', async () => {
    mockRead.fail = false;
    // The day's 40 includes the row being edited (30): other spending that day is 10.
    expect((await hintFor({amount: 30, date: '2025-11-08T09:00:00'}))?.dailyRemaining).toBe(80);
  });

  it('a row moved here from another month takes nothing off this month (it was never in it)', async () => {
    // The current month, so the allowance adapts to what was spent before the day.
    jest.useFakeTimers({now: new Date(2025, 10, 8, 12), advanceTimers: true});
    mockRead.fail = false;
    Object.assign(mockSpend, {spentOnDay: 0, spentBeforeDay: 600});
    try {
      const fresh = await hintFor();
      // (3000 − 600) over the 23 days from the 8th, less the 10 typed.
      expect(fresh?.dailyBudget).toBeCloseTo(2400 / 23, 6);
      // The old code took the moved row's 500 off the 600: (3000 − 100) / 23, a wrong, larger allowance.
      expect(await hintFor({amount: 500, date: '2025-10-20T09:00:00'})).toEqual(fresh);
    } finally {
      Object.assign(mockSpend, {spentOnDay: 40, spentBeforeDay: 0});
      jest.useRealTimers();
    }
  });

  it('shows nothing when the month cannot be read', async () => {
    mockRead.fail = true;
    expect(await hintFor()).toBeNull();
  });
});
