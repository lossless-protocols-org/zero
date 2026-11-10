import React, {memo, useCallback, useMemo} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {displayCategoryName} from '../../../i18n/displayNames';
import {Icon} from '../../../ui/atoms/Icons';
import type {IconName} from '../../../ui/atoms/IconRegistry';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {SwipeableRow} from '../../../ui/atoms/SwipeableRow';
import type {RowExtraAction} from '../../../ui/hooks/useRowActions';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import type {CategoryData, CategoryKind} from '../../../domain/types';
import type {OrderMove} from '../../../domain/categoryOrder';
import {gs} from '../../../ui/globalStyles';
import {hexToRgba} from '../../../ui/colorUtils';

type Category = CategoryData;

/** The accessibility action name of each move (stable ids) and its label. */
const MOVE_ACTION = {top: 'moveTop', up: 'moveUp', down: 'moveDown'} as const satisfies Record<OrderMove, string>;
const MOVE_LABEL = {
  top: 'categories.moveTop',
  up: 'categories.moveUp',
  down: 'categories.moveDown',
} as const satisfies Record<OrderMove, string>;

/** One category in the Categories tab: swipe to edit or delete, long-press to move it. */
export const CategoryRow = memo(
  ({
    category,
    colors,
    onEdit,
    onDelete,
    onMove,
    isFirst,
    isLast,
    openSwipeableRef,
    tutorialSwipeRef,
  }: {
    category: Category;
    colors: ThemeColors;
    onEdit: (id: string) => void;
    /** Absent for the only income category: money in always needs one. */
    onDelete?: (id: string) => void;
    onMove: (kind: CategoryKind, id: string, move: OrderMove) => void;
    isFirst: boolean;
    isLast: boolean;
    openSwipeableRef: React.RefObject<{close: () => void} | null>;
    tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  }) => {
    const {t} = useTranslation();
    const name = displayCategoryName(category.name, t);

    const handleEdit = useCallback(() => {
      onEdit(String(category.id));
    }, [onEdit, category.id]);

    const handleDelete = useCallback(() => {
      onDelete?.(category.id);
    }, [onDelete, category.id]);

    // Reorder (bug sheet #15): in the long-press menu and as screen-reader actions.
    const extraActions = useMemo<RowExtraAction[]>(() => {
      const action = (move: OrderMove, icon: IconName): RowExtraAction => ({
        name: MOVE_ACTION[move],
        label: t(MOVE_LABEL[move]),
        icon,
        onPress: () => onMove(category.kind, category.id, move),
      });
      return [
        ...(isFirst ? [] : [action('top', 'arrow-up-circle'), action('up', 'arrow-up-circle')]),
        ...(isLast ? [] : [action('down', 'arrow-down-circle')]),
      ];
    }, [onMove, category.kind, category.id, isFirst, isLast, t]);

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          onEdit={handleEdit}
          onDelete={onDelete ? handleDelete : undefined}
          extraActions={extraActions}
          menuTitle={name}
          accessibilityLabel={name}
          colors={colors}
          swipeRef={tutorialSwipeRef}
          openSwipeableRef={openSwipeableRef}>
          <View style={[gs.rounded12, gs.rowCenter, gs.px14, gs.py12, {backgroundColor: colors.containerColor}]}>
            <View
              style={[
                gs.size36,
                gs.rounded10,
                gs.center,
                {backgroundColor: hexToRgba(category.color || colors.primaryText, 0.094)},
              ]}>
              <Icon dynamicName={category.icon || 'shapes'} size={18} color={category.color || colors.primaryText} />
            </View>
            <PrimaryText weight="medium" size={14} style={gs.ml12} numberOfLines={1}>
              {name}
            </PrimaryText>
          </View>
        </SwipeableRow>
      </View>
    );
  },
);
