import {View, type LayoutChangeEvent} from 'react-native';
import React, {useCallback, useMemo, useRef} from 'react';
import type {TFunction} from 'i18next';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {displayCategoryName} from '../../../i18n/displayNames';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {Icon} from '../../../ui/atoms/Icons';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {SwipeableRow} from '../../../ui/atoms/SwipeableRow';
import type {RowExtraAction} from '../../../ui/hooks/useRowActions';
import {navigate} from '../../../platform/navigationUtils';
import {refundableRemainder} from '../../../domain/periodMath';
import type {ExpenseWithCategory} from '../../../domain/types';
import {gs} from '../../../ui/globalStyles';
import type {ExpenseListRow} from '../listRows';

interface ExpenseRowProps {
  expense: ExpenseListRow;
  colors: ThemeColors;
  onEdit: (expense: ExpenseWithCategory) => void;
  /** With the card's measured height, so the undo strip can take its place exactly. */
  onDelete: (expenseId: string, cardHeight: number) => void;
  openSwipeableRef: React.RefObject<{close: () => void} | null>;
  edgeToEdge: boolean;
  tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  dayLabel: string;
  /** From the list, once: a row subscribes to nothing of its own (audit 2026-11-08 §8.3). */
  t: TFunction;
  formatAmount: (amount: number) => string;
}

/**
 * Re-render only when what the row shows changed. The list's rows are new
 * objects after every refetch (each Home focus), so the default identity
 * check re-rendered every mounted row each time (audit 2026-11-08 §8.3).
 */
const sameRow = (a: ExpenseListRow, b: ExpenseListRow): boolean =>
  a === b ||
  (a.id === b.id &&
    a.title === b.title &&
    a.amount === b.amount &&
    a.description === b.description &&
    a.date === b.date &&
    a.refunded === b.refunded &&
    a.category?.name === b.category?.name &&
    a.category?.icon === b.category?.icon &&
    a.category?.color === b.category?.color);

const sameProps = (a: ExpenseRowProps, b: ExpenseRowProps): boolean =>
  sameRow(a.expense, b.expense) &&
  a.colors === b.colors &&
  a.onEdit === b.onEdit &&
  a.onDelete === b.onDelete &&
  a.openSwipeableRef === b.openSwipeableRef &&
  a.edgeToEdge === b.edgeToEdge &&
  a.tutorialSwipeRef === b.tutorialSwipeRef &&
  a.dayLabel === b.dayLabel &&
  a.t === b.t &&
  a.formatAmount === b.formatAmount;

/** An expense in a spending list: swipe to edit or delete, long-press for "Got money back". */
export const ExpenseRow: React.FC<ExpenseRowProps> = React.memo(
  ({expense, colors, onEdit, onDelete, openSwipeableRef, edgeToEdge, tutorialSwipeRef, dayLabel, t, formatAmount}) => {
    const amount = formatAmount(expense.amount);
    const categoryName = expense.category?.name ? displayCategoryName(expense.category.name, t) : undefined;

    const handleEdit = useCallback(() => {
      onEdit(expense);
    }, [onEdit, expense]);

    // Written on layout, read on delete: a ref, so measuring never re-renders the row.
    const cardHeight = useRef(0);
    const measure = useCallback((event: LayoutChangeEvent) => {
      cardHeight.current = event.nativeEvent.layout.height;
    }, []);
    const handleDelete = useCallback(() => {
      onDelete(String(expense.id), cardHeight.current);
    }, [onDelete, expense.id]);

    // "Got money back" while anything is left to come back (R12: refunds are
    // created only from their expense).
    const canRefund = refundableRemainder(expense.amount, expense.refunded) > 0;
    const extraActions = useMemo<RowExtraAction[]>(
      () =>
        canRefund
          ? [
              {
                name: 'refund',
                label: t('refund.gotMoneyBack'),
                icon: 'undo-2',
                onPress: () => navigate('RefundScreen', {expenseId: String(expense.id)}),
              },
            ]
          : [],
      [canRefund, expense.id, t],
    );
    const refundedLabel = expense.refunded > 0 ? t('refund.refunded', {amount: formatAmount(expense.refunded)}) : '';

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          rowKey={String(expense.id)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          extraActions={extraActions}
          menuTitle={expense.title}
          accessibilityLabel={[expense.title, amount, refundedLabel, categoryName, expense.description, dayLabel]
            .filter(Boolean)
            .join(', ')}
          colors={colors}
          swipeRef={tutorialSwipeRef}
          openSwipeableRef={openSwipeableRef}
          edgeToEdge={edgeToEdge}>
          <View
            onLayout={measure}
            style={[
              gs.rounded12,
              gs.rowBetweenCenter,
              gs.px14,
              gs.py10,
              edgeToEdge && gs.mx16,
              {backgroundColor: colors.containerColor},
            ]}>
            <View style={[gs.rowCenter, gs.flex1]}>
              <View style={[gs.size36, gs.center, gs.rounded10, gs.mr10, {backgroundColor: colors.iconContainer}]}>
                <Icon
                  dynamicName={expense.category?.icon || 'circle-dot'}
                  size={18}
                  color={expense.category?.color || colors.buttonText}
                />
              </View>
              <View style={[gs.flex1, gs.gap2]}>
                <PrimaryText weight="medium" numberOfLines={1}>
                  {expense.title}
                </PrimaryText>
                <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
                  {categoryName}
                  {expense.description ? ` · ${expense.description}` : ''}
                  {' · '}
                  {dayLabel}
                </PrimaryText>
              </View>
            </View>
            <View style={[gs.ml10, gs.itemsEnd]}>
              <Amount>{amount}</Amount>
              {refundedLabel ? (
                <Amount size={10} weight="medium" color={colors.accentGreen}>
                  {refundedLabel}
                </Amount>
              ) : null}
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  },
  sameProps,
);
