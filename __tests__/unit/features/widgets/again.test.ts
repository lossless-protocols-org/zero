import {pickAgain, pickLast, type AgainSource} from '../../../../src/features/widgets/again';

const active = new Set(['food', 'bus']);
const e = (title: string, amount: number, categoryId: string, date: string): AgainSource => ({
  title,
  amount,
  categoryId,
  date,
});

describe('pickAgain', () => {
  it('offers only what was entered at least twice, most recently used first', () => {
    const picked = pickAgain(
      [
        e('Chai', 20, 'food', '2026-11-01T08:00:00'),
        e('Laptop', 60000, 'food', '2026-11-06T10:00:00'),
        e('Bus', 15, 'bus', '2026-11-02T09:00:00'),
        e('chai ', 20, 'food', '2026-11-05T08:00:00'),
        e('Bus', 15, 'bus', '2026-11-04T09:00:00'),
      ],
      active,
    );
    expect(picked).toEqual([
      {title: 'Chai', amount: 20, categoryId: 'food'},
      {title: 'Bus', amount: 15, categoryId: 'bus'},
    ]);
  });

  it('treats a different amount or category as a different entry', () => {
    const picked = pickAgain(
      [e('Chai', 20, 'food', '2026-11-01'), e('Chai', 25, 'food', '2026-11-02'), e('Chai', 20, 'bus', '2026-11-03')],
      active,
    );
    expect(picked).toEqual([]);
  });

  it('never offers an archived category and keeps at most three', () => {
    const many = ['a', 'b', 'c', 'd'].flatMap((t, i) => [
      e(t, 10 + i, 'food', `2026-11-0${i + 1}`),
      e(t, 10 + i, 'food', `2026-11-0${i + 1}`),
    ]);
    expect(pickAgain([...many, e('Old', 5, 'gone', '2026-11-09'), e('Old', 5, 'gone', '2026-11-09')], active)).toEqual([
      {title: 'd', amount: 13, categoryId: 'food'},
      {title: 'c', amount: 12, categoryId: 'food'},
      {title: 'b', amount: 11, categoryId: 'food'},
    ]);
  });
});

describe('pickLast', () => {
  it('is the latest expense in an active category', () => {
    expect(
      pickLast(
        [e('Chai', 20, 'food', '2026-11-01'), e('Old', 9, 'gone', '2026-11-09'), e('Bus', 15, 'bus', '2026-11-03')],
        active,
      ),
    ).toEqual({title: 'Bus', amount: 15, categoryId: 'bus'});
    expect(pickLast([], active)).toBeNull();
  });
});
