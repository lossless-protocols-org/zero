/**
 * One rule for "the same title" (audit 2026-11-08 §3.13): categorise-from-
 * history must follow SQLite's lower(trim()) because an index answers it, and
 * "Add again" now groups titles by the same rule instead of lowering Unicode.
 */
import {titleKey} from '../../../src/domain/titleKey';
import {pickAgain} from '../../../src/features/widgets/again';

const row = (title: string, date: string) => ({title, amount: 20, categoryId: 'food', date});
const active = new Set(['food']);

describe('titleKey', () => {
  it('drops outer spaces and lowers ASCII only, as SQLite does', () => {
    expect(titleKey('  Chai ')).toBe('chai');
    expect(titleKey('Çay')).toBe('Çay');
  });

  it('"Add again" groups titles by the same rule', () => {
    expect(pickAgain([row('Chai', '2026-11-01'), row('chai ', '2026-11-02')], active)).toHaveLength(1);
    // Different for history, so different for Add again: neither was entered twice.
    expect(pickAgain([row('Çay', '2026-11-01'), row('çay', '2026-11-02')], active)).toEqual([]);
  });
});
