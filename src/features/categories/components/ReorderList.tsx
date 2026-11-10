import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {StyleSheet, View, type AccessibilityActionEvent} from 'react-native';
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Icon} from '../../../ui/atoms/Icons';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {hexToRgba} from '../../../ui/colorUtils';
import {gs} from '../../../ui/globalStyles';

export interface ReorderItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
}

interface ReorderListProps {
  items: readonly ReorderItem[];
  colors: ThemeColors;
  /** Called once per drop (or screen-reader move) with every id in its new order. */
  onReorder: (orderedIds: string[]) => void;
}

/** A row's height and the gap under it: rows sit on a fixed grid, so a drag maps to a slot by division. */
const ROW_HEIGHT = 60;
const STEP = ROW_HEIGHT + 6;
const SPRING = {damping: 22, stiffness: 260, mass: 0.6} as const;

/**
 * Drag to reorder (2.8, bug sheet #15). Own code on Reanimated and
 * gesture-handler, no package: each row sits at `slot × STEP`; the dragged
 * row follows the finger on the UI thread and the others spring into the slot
 * it vacates. The grip starts a drag after a short hold, so a scroll that
 * starts on it still scrolls. The order is saved on drop. Screen readers get
 * Move up / Move down on every row instead (the same save).
 */
const ReorderListComponent: React.FC<ReorderListProps> = ({items, colors, onReorder}) => {
  const ids = useMemo(() => items.map(item => item.id), [items]);
  const order = useSharedValue<string[]>(ids);
  // A new list from the store (after a save, or a category added) is the truth.
  const idsKey = ids.join('|');
  useEffect(() => {
    order.value = ids;
    // ids changes identity on every render; its content is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const commit = useCallback((next: string[]) => onReorder(next), [onReorder]);

  /** Screen-reader move: one slot up or down, saved at once. */
  const move = useCallback(
    (id: string, by: -1 | 1) => {
      const next = [...order.value];
      const from = next.indexOf(id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= next.length) {
        return;
      }
      next.splice(from, 1);
      next.splice(to, 0, id);
      order.value = next;
      onReorder(next);
    },
    [order, onReorder],
  );

  return (
    <View style={{height: items.length * STEP}}>
      {items.map(item => (
        <ReorderRow
          key={item.id}
          item={item}
          count={items.length}
          order={order}
          colors={colors}
          onDrop={commit}
          onMove={move}
        />
      ))}
    </View>
  );
};

interface ReorderRowProps {
  item: ReorderItem;
  count: number;
  order: SharedValue<string[]>;
  colors: ThemeColors;
  onDrop: (orderedIds: string[]) => void;
  onMove: (id: string, by: -1 | 1) => void;
}

const ReorderRow: React.FC<ReorderRowProps> = memo(({item, count, order, colors, onDrop, onMove}) => {
  const {t} = useTranslation();
  const {id} = item;
  const slot = useDerivedValue(() => order.value.indexOf(id));
  const dragging = useSharedValue(false);
  const top = useSharedValue(0);
  const start = useSharedValue(0);

  const pan = usePanGesture({
    activateAfterLongPress: 120,
    onActivate: () => {
      'worklet';
      start.value = slot.value * STEP;
      top.value = start.value;
      dragging.value = true;
    },
    onUpdate: event => {
      'worklet';
      const y = Math.min(Math.max(start.value + event.translationY, 0), (count - 1) * STEP);
      top.value = y;
      const to = Math.round(y / STEP);
      const from = order.value.indexOf(id);
      if (to !== from && from >= 0) {
        const next = [...order.value];
        next.splice(from, 1);
        next.splice(to, 0, id);
        order.value = next;
      }
    },
    onDeactivate: () => {
      'worklet';
      dragging.value = false;
      scheduleOnRN(onDrop, order.value);
    },
  });

  const style = useAnimatedStyle(() => ({
    top: dragging.value ? top.value : withSpring(slot.value * STEP, SPRING),
    zIndex: dragging.value ? 2 : 1,
    transform: [{scale: withTiming(dragging.value ? 1.03 : 1, {duration: 120})}],
    shadowOpacity: withTiming(dragging.value ? 0.18 : 0, {duration: 120}),
    elevation: dragging.value ? 6 : 0,
  }));

  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'moveUp') {
        onMove(id, -1);
      } else if (event.nativeEvent.actionName === 'moveDown') {
        onMove(id, 1);
      }
    },
    [onMove, id],
  );

  return (
    <Animated.View
      style={[gs.absolute, styles.row, style]}
      accessible
      accessibilityLabel={item.label}
      accessibilityHint={t('categories.reorderHint')}
      accessibilityActions={[
        {name: 'moveUp', label: t('categories.moveUp')},
        {name: 'moveDown', label: t('categories.moveDown')},
      ]}
      onAccessibilityAction={onAction}>
      <View style={[gs.flex1, gs.rounded12, gs.rowCenter, styles.body, {backgroundColor: colors.containerColor}]}>
        <View
          style={[
            gs.size36,
            gs.rounded10,
            gs.center,
            {backgroundColor: hexToRgba(item.color || colors.primaryText, 0.094)},
          ]}>
          <Icon dynamicName={item.icon || 'shapes'} size={18} color={item.color || colors.primaryText} />
        </View>
        <PrimaryText weight="medium" size={14} style={[gs.ml12, gs.flex1]} numberOfLines={1}>
          {item.label}
        </PrimaryText>
        <GestureDetector gesture={pan}>
          <View style={[styles.grip, gs.center]} importantForAccessibility="no-hide-descendants">
            <Icon name="grip-vertical" size={20} color={colors.secondaryText} />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    shadowColor: '#000',
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  },
  body: {paddingLeft: 14},
  /** 48 × 48: the grip's touch target (WCAG 2.5.8 / Android's 48 dp). */
  grip: {width: 48, height: 48},
});

export const ReorderList = memo(ReorderListComponent);
