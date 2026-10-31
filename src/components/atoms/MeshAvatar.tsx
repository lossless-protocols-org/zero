import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Line} from 'react-native-svg';
import PrimaryText from './PrimaryText';

interface MeshAvatarProps {
  name: string;
  size?: number;
  bgColor: string;
  textColor: string;
  meshColor: string;
}

const GRID_COUNT = 12;
const LINE_OPACITY = 0.28;

/**
 * Initials over a hairline mesh grid.
 *
 * Two things keep the initials on screen, and the second one is the one that
 * actually bit us:
 *
 * 1. Painting order. The initials are a STATIC child centered by the
 *    container's own flex alignment — no absolute positioning, no zIndex.
 *    Fabric has documented problems honouring zIndex
 *    (facebook/react-native#38513) and mis-measuring absolutely-positioned
 *    layers under overflow:hidden (#48392); a static child declared last
 *    simply paints last. The mesh is ONE absolutely-positioned <Svg> drawn
 *    before it, pointerEvents="none" so it never intercepts the avatar tap.
 *
 * 2. Font scaling. The circle is a FIXED `size` px with overflow:hidden, so
 *    the glyphs must not scale with the OS display-font setting: at a large
 *    setting the text outgrows the circle, wraps to two lines and is clipped
 *    away entirely — the avatar renders as a bare mesh with no initials, on
 *    exactly the devices whose owners raised their font size. Hence
 *    allowFontScaling={false} + numberOfLines={1}. The user's name sits
 *    beside the avatar in fully scalable text, so nothing is lost.
 */
const MeshAvatar: React.FC<MeshAvatarProps> = ({name, size = 40, bgColor, textColor, meshColor}) => {
  const initials = useMemo(
    () =>
      (name ?? '')
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [name],
  );

  const fontSize = Math.round(size * 0.42);

  const meshLines = useMemo(() => {
    const step = size / GRID_COUNT;
    const lines = [];
    for (let i = 1; i < GRID_COUNT; i++) {
      const pos = step * i;
      lines.push(
        <Line
          key={`h${i}`}
          x1={0}
          y1={pos}
          x2={size}
          y2={pos}
          stroke={meshColor}
          strokeWidth={StyleSheet.hairlineWidth}
          opacity={LINE_OPACITY}
        />,
        <Line
          key={`v${i}`}
          x1={pos}
          y1={0}
          x2={pos}
          y2={size}
          stroke={meshColor}
          strokeWidth={StyleSheet.hairlineWidth}
          opacity={LINE_OPACITY}
        />,
      );
    }
    return lines;
  }, [size, meshColor]);

  return (
    <View style={[styles.container, {width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor}]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        {meshLines}
      </Svg>
      <PrimaryText size={fontSize} weight="bold" color={textColor} numberOfLines={1} allowFontScaling={false}>
        {initials}
      </PrimaryText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default memo(MeshAvatar);
