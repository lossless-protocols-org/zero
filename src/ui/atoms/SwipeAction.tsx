import React, {memo} from 'react';
import {TouchableOpacity} from 'react-native-gesture-handler';
import Animated, {type SharedValue, useAnimatedStyle, interpolate} from 'react-native-reanimated';
import {Icon} from './Icons';
import type {IconName} from './IconRegistry';
import {gs} from '../globalStyles';

const ACTION_WIDTH = 50;
const EDGE_INSET = 16;

/** The edit or delete circle a swipe reveals behind a row (SwipeableRow). */
export const SwipeAction = memo(
  ({
    progress,
    iconName,
    iconColor,
    backgroundColor,
    side,
    onPress,
    accessibilityLabel,
    edgeToEdge = false,
    armed,
  }: {
    /** False until the row starts opening: then only the empty, fixed-width slot exists. */
    armed: boolean;
    progress: SharedValue<number>;
    iconName: IconName;
    iconColor: string;
    backgroundColor: string;
    side: 'left' | 'right';
    onPress: () => void;
    accessibilityLabel: string;
    edgeToEdge?: boolean;
  }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.8, 1]),
      transform: [{scale: interpolate(progress.value, [0, 1], [0.6, 1])}],
    }));

    const extraPadding = edgeToEdge ? EDGE_INSET : 0;

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        // The row itself carries edit/delete as accessibility actions (M29);
        // these off-screen buttons would only add two silent stops per row.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          gs.center,
          gs.flex1,
          {width: ACTION_WIDTH + extraPadding},
          side === 'left' ? {paddingLeft: extraPadding} : {paddingRight: extraPadding},
        ]}>
        {armed ? (
          <Animated.View style={[gs.size40, gs.roundedFull, gs.center, animatedStyle, {backgroundColor}]}>
            <Icon name={iconName} size={18} color={iconColor} />
          </Animated.View>
        ) : null}
      </TouchableOpacity>
    );
  },
);
