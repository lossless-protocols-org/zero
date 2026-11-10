import {View, type LayoutChangeEvent} from 'react-native';
import React, {useCallback, useRef} from 'react';
import type {TFunction} from 'i18next';
import {displayCategoryName} from '../../../i18n/displayNames';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {Icon} from '../../../ui/atoms/Icons';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {SwipeableRow} from '../../../ui/atoms/SwipeableRow';
import {Amount} from '../../../ui/atoms/Amount';
import {navigate} from '../../../platform/navigationUtils';
import {gs} from '../../../ui/globalStyles';
import type {RefundListItemRow} from '../listRows';

interface RefundRowProps {
  refund: RefundListItemRow;
  colors: ThemeColors;
  onDelete: (id: string, cardHeight: number) => void;
  openSwipeableRef: React.RefObject<{close: () => void} | null>;
  edgeToEdge: boolean;
  dayLabel: string;
  /** From the list, once (as ExpenseRow). */
  t: TFunction;
  formatAmount: (amount: number) => string;
}

/** Re-render only when what the row shows changed (as ExpenseRow: rows are new objects after each refetch). */
const sameProps = (a: RefundRowProps, b: RefundRowProps): boolean =>
  (a.refund === b.refund ||
    (a.refund.id === b.refund.id &&
      a.refund.expenseId === b.refund.expenseId &&
      a.refund.title === b.refund.title &&
      a.refund.amount === b.refund.amount &&
      a.refund.note === b.refund.note &&
      a.refund.category?.name === b.refund.category?.name &&
      a.refund.category?.color === b.refund.category?.color)) &&
  a.colors === b.colors &&
  a.onDelete === b.onDelete &&
  a.openSwipeableRef === b.openSwipeableRef &&
  a.edgeToEdge === b.edgeToEdge &&
  a.dayLabel === b.dayLabel &&
  a.t === b.t &&
  a.formatAmount === b.formatAmount;

/** Money that came back: the expense's title and category, the amount back, the refund's day. */
export const RefundRow: React.FC<RefundRowProps> = React.memo(
  ({refund, colors, onDelete, openSwipeableRef, edgeToEdge, dayLabel, t, formatAmount}) => {
    // A list row carries the signed spend amount (negative); the refund itself is positive.
    const back = formatAmount(-refund.amount);
    const categoryName = refund.category?.name ? displayCategoryName(refund.category.name, t) : undefined;

    const handleEdit = useCallback(() => {
      navigate('RefundScreen', {expenseId: refund.expenseId, refundId: refund.id});
    }, [refund.expenseId, refund.id]);
    const cardHeight = useRef(0);
    const measure = useCallback((event: LayoutChangeEvent) => {
      cardHeight.current = event.nativeEvent.layout.height;
    }, []);
    const handleDelete = useCallback(() => {
      onDelete(refund.id, cardHeight.current);
    }, [onDelete, refund.id]);

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          rowKey={refund.id}
          onEdit={handleEdit}
          onDelete={handleDelete}
          menuTitle={t('refund.editTitle')}
          accessibilityLabel={t('refund.rowLabel', {title: refund.title, amount: back, date: dayLabel})}
          colors={colors}
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
                <Icon name="undo-2" size={18} color={refund.category?.color || colors.accentGreen} />
              </View>
              <View style={[gs.flex1, gs.gap2]}>
                <PrimaryText weight="medium" numberOfLines={1}>
                  {refund.title}
                </PrimaryText>
                <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
                  {[t('refund.label'), categoryName, refund.note, dayLabel].filter(Boolean).join(' · ')}
                </PrimaryText>
              </View>
            </View>
            <View style={gs.ml10}>
              <Amount color={colors.accentGreen}>{t('refund.back', {amount: back})}</Amount>
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  },
  sameProps,
);
