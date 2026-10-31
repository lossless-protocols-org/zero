/**
 * Tests for the donut chart's geometry — the real module the component uses,
 * not a mirror of it.
 *
 * Two properties matter most here:
 *
 * 1. The separation between segments is a CONSTANT-width cut. A radial cut
 *    through a thick ring is a wedge (the same angle spans more arc at the
 *    outer edge than the inner), so the gap is drawn as a straight radial line
 *    rather than by shortening arcs. Straight lines have constant width.
 *
 * 2. Touch maps to the right segment. Hit testing is coordinate-based, so an
 *    off-by-90° in the angle convention would silently select the wrong
 *    category — exactly the kind of bug a device test finds late.
 */

import {
  buildGeometry,
  buildSegments,
  segmentAtPoint,
  SEGMENT_GAP_WIDTH,
  MIN_VISIBLE_ARC,
  type DonutSlice,
} from '../donutGeometry';

const slice = (key: string, value: number): DonutSlice => ({
  key,
  value,
  color: '#123456',
});

const geometry = buildGeometry(244);

/** Point on the ring's centreline at `degrees`, where -90 is twelve o'clock. */
const pointAt = (degrees: number, radius = geometry.radius) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: geometry.center + radius * Math.cos(radians),
    y: geometry.center + radius * Math.sin(radians),
  };
};

describe('geometry', () => {
  it('leaves canvas headroom so a grown segment is not clipped', () => {
    expect(geometry.canvas).toBe(geometry.diameter + geometry.expand * 2);
    expect(geometry.center).toBe(geometry.canvas / 2);
  });

  it('derives a band whose thickness is the stroke width', () => {
    expect(geometry.outerRadius - geometry.innerRadius).toBeCloseTo(geometry.strokeWidth, 6);
  });
});

describe('segments', () => {
  it('orders largest first so the ring matches the legend', () => {
    const segments = buildSegments([slice('a', 10), slice('b', 50), slice('c', 30)], geometry);
    expect(segments.map(s => s.key)).toEqual(['b', 'c', 'a']);
  });

  it('starts at twelve o’clock and closes the circle', () => {
    const segments = buildSegments([slice('a', 5), slice('b', 15), slice('c', 80)], geometry);
    expect(segments[0]?.startAngle).toBe(-90);
    const last = segments.at(-1);
    expect((last?.startAngle ?? NaN) + (last?.sweepAngle ?? NaN)).toBeCloseTo(270, 6); // -90 + 360
  });

  it('keeps sweep angles proportional to value', () => {
    const segments = buildSegments([slice('a', 50), slice('b', 25), slice('c', 25)], geometry);
    expect(segments[0]?.sweepAngle).toBeCloseTo(180, 6);
    expect(segments[1]?.sweepAngle).toBeCloseTo(90, 6);
  });

  it('floors the DRAWN arc for a tiny category without moving its angles', () => {
    const segments = buildSegments([slice('big', 9999), slice('tiny', 1)], geometry);
    const tiny = segments[1];
    expect(tiny?.arc).toBeGreaterThanOrEqual(SEGMENT_GAP_WIDTH + MIN_VISIBLE_ARC);
    // Angles must stay true or the ring drifts and fails to close.
    expect(tiny?.sweepAngle).toBeCloseTo((tiny?.fraction ?? NaN) * 360, 9);
  });

  it('ignores zero and negative values', () => {
    const segments = buildSegments([slice('a', 10), slice('zero', 0), slice('b', 20)], geometry);
    expect(segments.map(s => s.key)).toEqual(['b', 'a']);
  });

  it('returns nothing when there is no positive data', () => {
    expect(buildSegments([], geometry)).toHaveLength(0);
    expect(buildSegments([slice('a', 0)], geometry)).toHaveLength(0);
  });
});

describe('constant-width separation', () => {
  /**
   * Width the straight divider carves at a given radius, measured along the
   * line's normal. For a straight stroke this is its stroke width at every
   * radius — that invariance is the thing under test.
   */
  const carvedWidthAt = (radius: number, degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    const nx = -Math.sin(radians);
    const ny = Math.cos(radians);
    const half = SEGMENT_GAP_WIDTH / 2;
    const ax = radius * Math.cos(radians) + half * nx;
    const ay = radius * Math.sin(radians) + half * ny;
    const bx = radius * Math.cos(radians) - half * nx;
    const by = radius * Math.sin(radians) - half * ny;
    return Math.hypot(ax - bx, ay - by);
  };

  it('is identical at the inner and outer edge', () => {
    const segments = buildSegments([slice('a', 40), slice('b', 30), slice('c', 30)], geometry);
    for (const segment of segments) {
      const inner = carvedWidthAt(geometry.innerRadius, segment.startAngle);
      const outer = carvedWidthAt(geometry.outerRadius, segment.startAngle);
      expect(inner).toBeCloseTo(outer, 9);
      expect(outer).toBeCloseTo(SEGMENT_GAP_WIDTH, 9);
    }
  });

  it('holds at every radius through the band', () => {
    for (let r = geometry.innerRadius; r <= geometry.outerRadius; r += 4) {
      expect(carvedWidthAt(r, -90)).toBeCloseTo(SEGMENT_GAP_WIDTH, 9);
    }
  });
});

describe('touch hit testing', () => {
  const segments = buildSegments([slice('food', 50), slice('fuel', 25), slice('rent', 25)], geometry);
  // food: -90..90 (top-right half), fuel: 90..180, rent: 180..270

  it('selects the segment under the touch point', () => {
    const top = pointAt(-90 + 1); // just clockwise of twelve o'clock
    expect(segmentAtPoint(top.x, top.y, geometry, segments)?.key).toBe('food');
  });

  it('maps each quadrant to the right category', () => {
    const hitAt = (degrees: number) => {
      const {x, y} = pointAt(degrees);
      return segmentAtPoint(x, y, geometry, segments)?.key;
    };
    expect(hitAt(0)).toBe('food');
    expect(hitAt(120)).toBe('fuel');
    expect(hitAt(200)).toBe('rent');
  });

  it('respects boundaries — either side of a cut selects different segments', () => {
    const before = pointAt(89);
    const after = pointAt(91);
    expect(segmentAtPoint(before.x, before.y, geometry, segments)?.key).toBe('food');
    expect(segmentAtPoint(after.x, after.y, geometry, segments)?.key).toBe('fuel');
  });

  it('returns null for a touch in the hole', () => {
    const inHole = pointAt(0, geometry.innerRadius / 2);
    expect(segmentAtPoint(inHole.x, inHole.y, geometry, segments)).toBeNull();
  });

  it('returns null for a touch outside the ring', () => {
    const outside = pointAt(0, geometry.outerRadius + geometry.expand + 40);
    expect(segmentAtPoint(outside.x, outside.y, geometry, segments)).toBeNull();
  });

  it('still hits a segment that has grown on selection', () => {
    // The bug react-native-gifted-charts papers over with `edgesPressable`:
    // a grown segment's protruding edge must remain tappable.
    const grownEdge = pointAt(0, geometry.outerRadius + geometry.expand);
    expect(segmentAtPoint(grownEdge.x, grownEdge.y, geometry, segments)?.key).toBe('food');
  });

  it('accepts a touch slightly inside or outside the band', () => {
    const justInside = pointAt(0, geometry.innerRadius - 4);
    const justOutside = pointAt(0, geometry.outerRadius + 4);
    expect(segmentAtPoint(justInside.x, justInside.y, geometry, segments)).not.toBeNull();
    expect(segmentAtPoint(justOutside.x, justOutside.y, geometry, segments)).not.toBeNull();
  });

  it('returns null when there is no data', () => {
    const anywhere = pointAt(0);
    expect(segmentAtPoint(anywhere.x, anywhere.y, geometry, [])).toBeNull();
  });

  it('selects the only segment anywhere on the ring when one category owns it', () => {
    const single = buildSegments([slice('solo', 100)], geometry);
    for (const degrees of [-90, 0, 90, 180]) {
      const point = pointAt(degrees);
      expect(segmentAtPoint(point.x, point.y, geometry, single)?.key).toBe('solo');
    }
  });
});
