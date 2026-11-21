import React, {memo} from 'react';
import {TouchableOpacity} from 'react-native-gesture-handler';
import Animated, {type SharedValue, useAnimatedStyle, interpolate} from 'react-native-reanimated';
import {Icon} from './Icons';
import type {IconName} from './IconRegistry';
import {gs} from '../globalStyles';

/** The circle a swipe reveals. */
const SWIPE_ACTION_CIRCLE = 40;
/** Space between the circle and the swiped row. */
const SWIPE_ACTION_GAP = 8;
/**
 * How far a row slides open, on every list. The circle's outer edge sits on
 * the row's resting edge and the gap faces the row; the side margin of an
 * edge-to-edge list belongs to the swipe container (SwipeableRow), never here.
 * @internal Exported so a test pins the one geometry every list shares.
 */
export const SWIPE_ACTION_SLOT_WIDTH = SWIPE_ACTION_CIRCLE + SWIPE_ACTION_GAP;

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
  }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.8, 1]),
      transform: [{scale: interpolate(progress.value, [0, 1], [0.6, 1])}],
    }));

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
          {width: SWIPE_ACTION_SLOT_WIDTH},
          side === 'left' ? {paddingRight: SWIPE_ACTION_GAP} : {paddingLeft: SWIPE_ACTION_GAP},
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
