/**
 * The selected month follows today across a month boundary on a warm start,
 * and a month picked on purpose stays (audit 2026-11-08 §3.9). A reset starts
 * on the month it is then, not the month the module loaded in.
 */
import {
  monthSelectionReducer as reducer,
  followToday,
  setMonthSelection,
} from '../../../../src/store/slices/monthSelectionSlice';
import {rootReducer, resetSession} from '../../../../src/store/rootReducer';

const at = (year: number, month: number, day = 15) => new Date(year, month - 1, day, 12);
const init = (now: Date) =>
  reducer(undefined, setMonthSelection({monthIndex: now.getMonth(), year: now.getFullYear()}, now));

describe('monthSelection', () => {
  it('starts on the current month, following today', () => {
    const now = new Date();
    expect(reducer(undefined, {type: 'init'})).toEqual({
      monthIndex: now.getMonth(),
      year: now.getFullYear(),
      followsToday: true,
    });
  });

  it('moves a "this month" selection into the new month on resume', () => {
    const october = init(at(2026, 10, 31));
    expect(reducer(october, followToday(at(2026, 11, 1)))).toEqual({monthIndex: 10, year: 2026, followsToday: true});
  });

  it('rolls over the year the same way', () => {
    const december = init(at(2026, 12, 31));
    expect(reducer(december, followToday(at(2027, 1, 1)))).toEqual({monthIndex: 0, year: 2027, followsToday: true});
  });

  it('leaves a month picked on purpose where it is', () => {
    const now = at(2026, 10, 20);
    const august = reducer(init(now), setMonthSelection({monthIndex: 7, year: 2026}, now));
    expect(august.followsToday).toBe(false);
    expect(reducer(august, followToday(at(2026, 11, 1)))).toBe(august);
  });

  it('follows again once the user comes back to the current month', () => {
    const now = at(2026, 10, 20);
    const back = reducer(
      reducer(init(now), setMonthSelection({monthIndex: 7, year: 2026}, now)),
      setMonthSelection({monthIndex: 9, year: 2026}, now),
    );
    expect(back.followsToday).toBe(true);
    expect(reducer(back, followToday(at(2026, 11, 2))).monthIndex).toBe(10);
  });

  it('a resume in the same month changes nothing (no re-render)', () => {
    const october = init(at(2026, 10, 3));
    expect(reducer(october, followToday(at(2026, 10, 28)))).toEqual(october);
  });

  it('a session reset starts on the month it is now', () => {
    const now = new Date();
    const august = rootReducer(undefined, setMonthSelection({monthIndex: (now.getMonth() + 6) % 12, year: 2001}));
    expect(rootReducer(august, resetSession()).monthSelection).toEqual({
      monthIndex: now.getMonth(),
      year: now.getFullYear(),
      followsToday: true,
    });
  });
});
