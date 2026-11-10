/**
 * M32 (v2.7.1): percentages follow the user's locale — digits, separators and
 * the percent sign's side — instead of an English literal (`${pct}%`).
 */
import {formatPercent} from '../../../src/platform/numberFormat';
import {clearErrorLog, getErrorLog} from '../../../src/platform/errorLog';

describe('formatPercent', () => {
  it('puts the sign where the locale does', () => {
    expect(formatPercent(42, 'en-US')).toBe('42%');
    expect(formatPercent(42, 'tr-TR')).toBe('%42');
    // A no-break space, so the sign never wraps onto its own line.
    expect(formatPercent(42, 'de-DE')).toBe('42\u00a0%');
  });

  it('uses the locale digits', () => {
    expect(formatPercent(42, 'ar-EG')).toContain('٤٢');
  });

  it('falls back to en-US for a locale Intl rejects, logging it once', () => {
    clearErrorLog();
    expect(formatPercent(42, 'not a tag')).toBe('42%');
    expect(formatPercent(43, 'not a tag')).toBe('43%');
    expect(getErrorLog()).toHaveLength(1);
  });

  it('takes whole percents and keeps over-budget values', () => {
    expect(formatPercent(0, 'en-US')).toBe('0%');
    expect(formatPercent(150, 'en-US')).toBe('150%');
  });
});
