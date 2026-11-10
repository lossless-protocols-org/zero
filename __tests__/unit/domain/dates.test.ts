import {shiftYearMonth} from '../../../src/domain/dates';

describe('shiftYearMonth', () => {
  it('steps across months and years both ways', () => {
    expect(shiftYearMonth('2026-11', -1)).toBe('2026-10');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-03', -14)).toBe('2025-01');
  });
});
