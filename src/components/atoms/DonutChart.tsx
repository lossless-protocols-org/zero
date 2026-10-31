import React, {useCallback, useMemo, useState} from 'react';
import {GestureResponderEvent, Pressable, useWindowDimensions, View} from 'react-native';
import Svg, {Circle, G, Line} from 'react-native-svg';
import PrimaryText from './PrimaryText';
import type {ThemeColors} from '../../hooks/useThemeColors';
import {
  buildGeometry,
  buildSegments,
  segmentAtPoint,
  SEGMENT_GAP_WIDTH,
  type DonutSlice,
} from '../../utils/donutGeometry';
import {gs} from '../../styles/globalStyles';
import {formatPercent} from '../../utils/numberUtils';

export type {DonutSlice};

interface DonutChartProps {
  data: Array<DonutSlice>;
  colors: ThemeColors;
  /** Overrides the responsive diameter. Mostly for tests/snapshots. */
  size?: number;
  /** Formats the selected segment's value for the centre readout. */
  formatValue?: (value: number) => string;
  /** Fires with the selected slice key, or null when cleared. */
  onSelectionChange?: (key: string | null) => void;
  accessibilityLabel?: string;
}

/** Share of the viewport width the chart occupies, and its ceiling on tablets. */
const WIDTH_RATIO = 0.62;
const MAX_DIAMETER = 260;
/** Overshoot on the dividers so antialiasing leaves no sliver at the edges. */
const DIVIDER_OVERSHOOT = 2;
/** Dimming applied to unselected segments while something is selected. */
const DIMMED_OPACITY = 0.35;

/**
 * Interactive donut chart drawn with native SVG primitives — no d3, no chart
 * library, and no dependency beyond react-native-svg (which the icon set
 * already requires). All geometry lives in utils/donutGeometry.
 *
 * Segments are circles masked to a single dash
 * (`strokeDasharray = [arc, circumference - arc]`) rotated to their start
 * angle, drawn at their FULL proportional arc.
 *
 * Separation is cut afterwards by straight radial <Line>s in the theme
 * background colour. That is deliberate, and the reason the gap is NOT made by
 * shortening the arcs: a radial cut through a thick ring is a WEDGE — the same
 * angle spans more arc at the outer edge than at the inner one, so a dash-based
 * gap renders narrow inside and wide outside. A straight stroked line has
 * constant width along its whole length, so the cut measures exactly
 * SEGMENT_GAP_WIDTH everywhere. Because the divider colour IS the background,
 * the lines can overshoot the band harmlessly.
 *
 * Selection follows the pattern Recharts uses for `activeShape`: the chosen
 * segment grows outward, its peers dim, and the centre reports what was picked.
 */
const DonutChart: React.FC<DonutChartProps> = ({
  data,
  colors,
  size,
  formatValue,
  onSelectionChange,
  accessibilityLabel,
}) => {
  const {width} = useWindowDimensions();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const geometry = useMemo(
    () => buildGeometry(size ?? Math.min(Math.round(width * WIDTH_RATIO), MAX_DIAMETER)),
    [size, width],
  );

  const segments = useMemo(() => buildSegments(data, geometry), [data, geometry]);

  // A category can vanish between renders (month change, deletion), so resolve
  // the selection against the current segments rather than trusting the key.
  const selected = useMemo(
    () => segments.find(segment => segment.key === selectedKey) ?? null,
    [segments, selectedKey],
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const {locationX, locationY} = event.nativeEvent;
      const hit = segmentAtPoint(locationX, locationY, geometry, segments);
      // Tapping the selected segment again, or missing the ring, clears it.
      const next = !hit || hit.key === selectedKey ? null : hit.key;
      setSelectedKey(next);
      onSelectionChange?.(next);
    },
    [geometry, segments, selectedKey, onSelectionChange],
  );

  const {canvas, center, radius, strokeWidth, circumference, expand} = geometry;

  const dividers = useMemo(() => {
    if (segments.length < 2) {
      // A single category owns the whole ring; a lone cut would read as a notch.
      return [];
    }
    return segments.map(segment => {
      const radians = (segment.startAngle * Math.PI) / 180;
      const from = geometry.innerRadius - DIVIDER_OVERSHOOT;
      // Reach past the grown edge so a selected segment is cut too.
      const to = geometry.outerRadius + expand + DIVIDER_OVERSHOOT;
      return {
        key: segment.key,
        x1: center + from * Math.cos(radians),
        y1: center + from * Math.sin(radians),
        x2: center + to * Math.cos(radians),
        y2: center + to * Math.sin(radians),
      };
    });
  }, [segments, geometry, center, expand]);

  const percent = selected ? Math.round(selected.fraction * 100) : 0;
  const centreWidth = geometry.innerRadius * 1.7;

  return (
    <Pressable
      onPress={handlePress}
      style={[gs.center, {height: canvas}]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={canvas} height={canvas}>
        <G>
          {/* Track: gives the ring a shape to sit in, and keeps the chart from
              looking broken when only one tiny segment exists. */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.secondaryAccent}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segments.map(segment => {
            const isSelected = segment.key === selectedKey;
            // Growing the stroke alone would expand inward too; shifting the
            // radius by half the growth pins the inner edge and pushes only the
            // outer edge out — the Recharts `outerRadius + n` effect.
            const grownStroke = isSelected ? strokeWidth + expand : strokeWidth;
            const grownRadius = isSelected ? radius + expand / 2 : radius;
            const grownCircumference = 2 * Math.PI * grownRadius;
            // Re-scale the dash to the larger circle so the segment still spans
            // the same angle after growing.
            const arc = isSelected ? (segment.arc / circumference) * grownCircumference : segment.arc;
            return (
              <Circle
                key={segment.key}
                cx={center}
                cy={center}
                r={grownRadius}
                stroke={segment.color}
                strokeWidth={grownStroke}
                strokeLinecap="butt"
                fill="none"
                opacity={selected && !isSelected ? DIMMED_OPACITY : 1}
                strokeDasharray={[arc, grownCircumference - arc]}
                // originX/originY/rotation are deprecated in react-native-svg 15.
                transform={`rotate(${segment.startAngle}, ${center}, ${center})`}
              />
            );
          })}
          {/* Drawn last so each cut sits above every segment AND the track. */}
          {dividers.map(divider => (
            <Line
              key={`cut-${divider.key}`}
              x1={divider.x1}
              y1={divider.y1}
              x2={divider.x2}
              y2={divider.y2}
              stroke={colors.primaryBackground}
              strokeWidth={SEGMENT_GAP_WIDTH}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>

      {selected ? (
        <View style={[gs.center, gs.absolute, {width: canvas, height: canvas}]} pointerEvents="none">
          <PrimaryText size={12} color={colors.secondaryText} numberOfLines={1} style={{maxWidth: centreWidth}}>
            {selected.label ?? selected.key}
          </PrimaryText>
          <PrimaryText
            size={18}
            weight="semibold"
            variant="number"
            color={colors.primaryText}
            numberOfLines={1}
            style={{maxWidth: centreWidth}}>
            {formatValue ? formatValue(selected.value) : String(selected.value)}
          </PrimaryText>
          <PrimaryText size={11} weight="semibold" variant="number" color={selected.color}>
            {formatPercent(percent)}
          </PrimaryText>
        </View>
      ) : null}
    </Pressable>
  );
};

export default React.memo(DonutChart);
