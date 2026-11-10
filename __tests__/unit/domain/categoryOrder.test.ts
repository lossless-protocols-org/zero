import {placeActiveOrder} from '../../../src/domain/categoryOrder';

// a, b, d, e active; c archived (keeps its third slot)
const rows = [
  {id: 'a', active: true},
  {id: 'b', active: true},
  {id: 'c', active: false},
  {id: 'd', active: true},
  {id: 'e', active: true},
];

describe('placeActiveOrder (drag reorder)', () => {
  it('fills the active slots in the dragged order; archived ones stay put', () => {
    expect(placeActiveOrder(rows, ['e', 'a', 'b', 'd'])).toEqual(['e', 'a', 'c', 'b', 'd']);
    expect(placeActiveOrder(rows, ['b', 'a', 'd', 'e'])).toEqual(['b', 'a', 'c', 'd', 'e']);
  });

  it('is null when nothing moved', () => {
    expect(placeActiveOrder(rows, ['a', 'b', 'd', 'e'])).toBeNull();
  });

  it('is null for an order that is not exactly the active categories', () => {
    expect(placeActiveOrder(rows, ['a', 'b', 'd'])).toBeNull();
    expect(placeActiveOrder(rows, ['a', 'b', 'c', 'e'])).toBeNull();
    expect(placeActiveOrder(rows, ['a', 'b', 'd', 'x'])).toBeNull();
  });
});
