/**
 * Pure geometry for the donut chart. Kept out of the component so the maths is
 * directly testable — no SVG, no rendering, no React.
 */

export interface DonutSlice {
  /** Identity: selection and hiding match on it. */
  key: string;
  /** What is shown and read out; the key when absent. */
  label?: string;
  value: number;
  color: string;
}

interface DonutGeometry {
  /** Diameter of the ring itself (outer edge to outer edge). */
  diameter: number;
  strokeWidth: number;
  /** Radius of the stroke's centreline — what strokeDasharray is measured on. */
  radius: number;
  circumference: number;
  innerRadius: number;
  outerRadius: number;
  /** Svg canvas size: the ring plus room for a selected segment to grow. */
  canvas: number;
  /** Centre of the canvas. */
  center: number;
  /** How far a selected segment grows outward. */
  expand: number;
}

interface DonutSegment {
  key: string;
  label?: string;
  color: string;
  value: number;
  fraction: number;
  /** Drawn arc length; floored so a tiny category survives its two half-cuts. */
  arc: number;
  /** Degrees, -90 = twelve o'clock. Always derived from the TRUE fraction. */
  startAngle: number;
  sweepAngle: number;
}

/** Width of the cut between adjacent segments. Constant across the band. */
export const SEGMENT_GAP_WIDTH = 5;
/** Arc a segment keeps beyond the two half-cuts, so no category disappears. @internal test */
export const MIN_VISIBLE_ARC = 3;
/** Ring thickness as a share of the diameter. */
const THICKNESS_RATIO = 0.19;
/** How far the selected segment grows outward (the Recharts `+6` pattern). */
const SELECTION_EXPAND = 8;
/** Extra touch slop around the ring band, in points. */
const TOUCH_SLOP = 8;

export const buildGeometry = (diameter: number): DonutGeometry => {
  const strokeWidth = Math.round(diameter * THICKNESS_RATIO);
  const radius = (diameter - strokeWidth) / 2;
  const expand = SELECTION_EXPAND;
  return {
    diameter,
    strokeWidth,
    radius,
    circumference: 2 * Math.PI * radius,
    innerRadius: radius - strokeWidth / 2,
    outerRadius: radius + strokeWidth / 2,
    // Headroom so a grown segment is not clipped by the canvas edge.
    canvas: diameter + expand * 2,
    center: (diameter + expand * 2) / 2,
    expand,
  };
};

export const buildSegments = (data: Array<DonutSlice>, geometry: DonutGeometry): Array<DonutSegment> => {
  const positive = data.filter(slice => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return [];
  }

  // Largest first, clockwise from twelve o'clock: the data-viz convention, and
  // it keeps the ring in the same order as the legend below it.
  const ordered = [...positive].sort((a, b) => b.value - a.value);
  const minArc = SEGMENT_GAP_WIDTH + MIN_VISIBLE_ARC;

  let cumulative = 0;
  return ordered.map(slice => {
    const fraction = slice.value / total;
    const startAngle = cumulative * 360 - 90;
    cumulative += fraction;
    return {
      key: slice.key,
      label: slice.label,
      color: slice.color,
      value: slice.value,
      fraction,
      // Only the DRAWN arc gets a floor; the angles above stay proportional so
      // boundaries remain accurate and the ring closes exactly.
      arc: Math.max(fraction * geometry.circumference, minArc),
      startAngle,
      sweepAngle: fraction * 360,
    };
  });
};

const normalize = (degrees: number): number => ((degrees % 360) + 360) % 360;

/**
 * Maps a touch point to the segment under it, or null when the touch misses
 * the ring band (the hole and the area outside both deselect).
 *
 * Hit testing is done from coordinates rather than by putting `onPress` on the
 * SVG elements. Two reasons: `strokeDasharray` makes SVG hit areas unreliable
 * across platforms, and — as react-native-gifted-charts documents with its
 * `edgesPressable` prop — element-based hit areas do not follow a segment when
 * it grows on selection, leaving the protruding part untappable. Coordinates
 * have neither problem.
 */
export const segmentAtPoint = (
  x: number,
  y: number,
  geometry: DonutGeometry,
  segments: Array<DonutSegment>,
): DonutSegment | null => {
  if (segments.length === 0) {
    return null;
  }

  const dx = x - geometry.center;
  const dy = y - geometry.center;
  const distance = Math.hypot(dx, dy);

  const min = geometry.innerRadius - TOUCH_SLOP;
  // Selected segments grow outward, so accept taps out to the grown edge.
  const max = geometry.outerRadius + geometry.expand + TOUCH_SLOP;
  if (distance < min || distance > max) {
    return null;
  }

  // atan2 returns 0 at three o'clock, matching the -90 = twelve o'clock
  // convention the segment angles already use.
  const angle = normalize((Math.atan2(dy, dx) * 180) / Math.PI);

  for (const segment of segments) {
    const offset = normalize(angle - segment.startAngle);
    if (offset < segment.sweepAngle) {
      return segment;
    }
  }
  // Floating-point drift at the seam: fall back to the last segment.
  return segments.at(-1) ?? null;
};
