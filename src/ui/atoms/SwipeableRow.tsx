import React, {useCallback, useRef, memo, useEffect, useState} from 'react';
import {Pressable, View} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {useTranslation} from 'react-i18next';
import {swipeActionsPreference} from '../../platform/swipeActions';
import {usePreference} from '../hooks/usePreference';
import {useRowActions, type RowExtraAction} from '../hooks/useRowActions';
import {SwipeAction} from './SwipeAction';

interface SwipeableRowProps {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Screen-reader labels; swipe is otherwise the only affordance. */
  editLabel?: string;
  deleteLabel?: string;
  /** Shown as the title of the long-press menu when swipe is turned off. */
  menuTitle?: string;
  /** Actions besides edit and delete; see RowExtraAction. */
  extraActions?: readonly RowExtraAction[];
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

export const SwipeableRow: React.FC<SwipeableRowProps> = memo(
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
    extraActions,
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

    const {accessibilityActions, onAccessibilityAction, openMenu} = useRowActions({
      onEdit,
      onDelete,
      editLabel,
      deleteLabel,
      menuTitle,
      extraActions,
    });

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
          onAccessibilityAction={onAccessibilityAction}>
          {children}
        </View>
      ) : (
        children
      );

    if (!swipeEnabled) {
      return (
        // Touch only: assistive tech uses the row's own actions, so this wrapper
        // must not become a second, unlabelled element around it.
        <Pressable onLongPress={openMenu} delayLongPress={350} accessible={false}>
          {content}
        </Pressable>
      );
    }

    // Swipe on: edit and delete are swipes, and a long-press opens the same
    // menu as with swipe off (edit, delete, and any extra actions such as Move
    // up or Got money back). It used to open only on rows with extra actions,
    // so a refund row ignored the long-press an expense row answered (found on
    // the Moto, 2026-11-09).
    const swipeContent = (
      <Pressable onLongPress={openMenu} delayLongPress={350} accessible={false}>
        {content}
      </Pressable>
    );

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
        {swipeContent}
      </ReanimatedSwipeable>
    );
  },
);
