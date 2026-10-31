import {TouchableOpacity} from 'react-native-gesture-handler';
import React, {useCallback, useMemo, useRef, memo, useEffect, useState} from 'react';
import {Pressable, View, type AccessibilityActionEvent} from 'react-native';
import Animated, {SharedValue, useAnimatedStyle, interpolate} from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {SheetManager} from 'react-native-actions-sheet';
import Icon from './Icons';
import {gs} from '../../styles/globalStyles';
import {useTranslation} from 'react-i18next';
import {swipeActionsPreference} from '../../utils/swipeActions';
import {usePreference} from '../../hooks/usePreference';

const ACTION_WIDTH = 50;
const EDGE_INSET = 16;

interface SwipeableRowProps {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Screen-reader labels; swipe is otherwise the only affordance. */
  editLabel?: string;
  deleteLabel?: string;
  /** Shown as the title of the long-press menu when swipe is turned off. */
  menuTitle?: string;
  /**
   * What a screen reader says for the whole row ("Lunch, ₹12, Food, 5 Oct").
   * The row is one element carrying the edit/delete actions (M29).
   */
  accessibilityLabel?: string;
  children: React.ReactNode;
  colors: {
    accentGreen: string;
    accentOrange: string;
    lightAccent: string;
  };
  swipeRef?: React.RefObject<SwipeableMethods | null>;
  openSwipeableRef?: React.RefObject<{close: () => void} | null>;
  edgeToEdge?: boolean;
  /**
   * Identity of the row this instance shows. FlashList reuses a mounted row
   * for another item, and ReanimatedSwipeable keeps its open state across
   * prop changes, so a row left open would reappear open on a different
   * expense (S7, v2.7.1). When the key changes the row is closed.
   */
  rowKey?: string;
}

const SwipeAction = memo(
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
    iconName: string;
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

const SwipeableRow: React.FC<SwipeableRowProps> = memo(
  ({
    onEdit,
    onDelete,
    editLabel,
    deleteLabel,
    menuTitle,
    children,
    colors,
    swipeRef,
    openSwipeableRef,
    edgeToEdge = false,
    rowKey,
    accessibilityLabel,
  }) => {
    const {t} = useTranslation();
    const swipeEnabled = usePreference(swipeActionsPreference);
    const localRef = useRef<SwipeableMethods | null>(null);
    const combinedRef = swipeRef ?? localRef;

    useEffect(() => {
      // No-op on mount (nothing is open yet); closes a recycled row.
      combinedRef.current?.close();
    }, [rowKey, combinedRef]);

    // Every row used to draw both action circles and icons while closed; on
    // Android each SVG icon is a bitmap upload, which made the first scroll
    // after a cold start ~5 % janky (2.7.1 gate, Moto). They are drawn once the
    // row starts opening, where they fade in from 0 opacity anyway.
    const [actionsArmed, setActionsArmed] = useState(false);
    const armActions = useCallback(() => setActionsArmed(true), []);

    const handleSwipeWillOpen = useCallback(() => {
      setActionsArmed(true);
      if (openSwipeableRef?.current && openSwipeableRef.current !== combinedRef.current) {
        openSwipeableRef.current.close();
      }
      if (openSwipeableRef) {
        openSwipeableRef.current = combinedRef.current;
      }
    }, [openSwipeableRef, combinedRef]);

    /**
     * Accessibility actions are the ONLY way a screen-reader user can reach edit
     * and delete. The action buttons behind the row are labelled, but they are
     * revealed by a pan gesture that TalkBack and VoiceOver intercept, so
     * without this the rows were read-only for anyone using one — in an app
     * where swipe is the sole affordance for both operations.
     *
     * With this, VoiceOver exposes them via the rotor's Actions and TalkBack via
     * its local context menu.
     */
    const accessibilityActions = useMemo(() => {
      const actions: Array<{name: string; label: string}> = [];
      if (onEdit) {
        actions.push({name: 'edit', label: editLabel ?? t('common.edit')});
      }
      if (onDelete) {
        actions.push({name: 'delete', label: deleteLabel ?? t('common.delete')});
      }
      return actions;
    }, [onEdit, onDelete, editLabel, deleteLabel, t]);

    const handleAccessibilityAction = useCallback(
      (event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'edit') {
          onEdit?.();
        } else if (event.nativeEvent.actionName === 'delete') {
          onDelete?.();
        }
      },
      [onEdit, onDelete],
    );

    // Swipe off (Settings → "Swipe to edit or delete"): the same two actions
    // sit behind a long-press menu, so nothing can be deleted by a stray drag.
    const openActionsMenu = useCallback(() => {
      if (!onEdit && !onDelete) {
        return;
      }
      void SheetManager.show('row-actions-sheet', {
        payload: {
          title: menuTitle ?? t('common.moreActions'),
          editLabel: editLabel ?? t('common.edit'),
          deleteLabel: deleteLabel ?? t('common.delete'),
          onEdit,
          onDelete,
        },
      });
    }, [onEdit, onDelete, menuTitle, editLabel, deleteLabel, t]);

    // One accessible element: actions on a non-accessible view are not
    // reachable from the VoiceOver rotor, and an ungrouped row reads as
    // separate fragments (M29).
    const content =
      accessibilityActions.length > 0 ? (
        <View
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={t('common.rowActionsHint')}
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={handleAccessibilityAction}>
          {children}
        </View>
      ) : (
        children
      );

    if (!swipeEnabled) {
      return (
        // Touch only: assistive tech uses the row's own actions, so this wrapper
        // must not become a second, unlabelled element around it.
        <Pressable onLongPress={openActionsMenu} delayLongPress={350} accessible={false}>
          {content}
        </Pressable>
      );
    }

    return (
      <ReanimatedSwipeable
        ref={combinedRef}
        renderLeftActions={
          onEdit
            ? (progress, _translation, swipeableMethods) => (
                <SwipeAction
                  progress={progress}
                  iconName="pencil"
                  iconColor={colors.accentGreen}
                  backgroundColor={colors.lightAccent}
                  side="left"
                  armed={actionsArmed}
                  accessibilityLabel={editLabel ?? t('common.edit')}
                  edgeToEdge={edgeToEdge}
                  onPress={() => {
                    onEdit();
                    swipeableMethods.close();
                  }}
                />
              )
            : undefined
        }
        renderRightActions={
          onDelete
            ? (progress, _translation, swipeableMethods) => (
                <SwipeAction
                  progress={progress}
                  iconName="trash-2"
                  iconColor={colors.accentOrange}
                  backgroundColor={colors.lightAccent}
                  side="right"
                  armed={actionsArmed}
                  accessibilityLabel={deleteLabel ?? t('common.delete')}
                  edgeToEdge={edgeToEdge}
                  onPress={() => {
                    onDelete();
                    swipeableMethods.close();
                  }}
                />
              )
            : undefined
        }
        onSwipeableWillOpen={handleSwipeWillOpen}
        onSwipeableOpenStartDrag={armActions}
        friction={2}
        overshootLeft={false}
        overshootRight={false}
        overshootFriction={8}>
        {content}
      </ReanimatedSwipeable>
    );
  },
);

export default SwipeableRow;
