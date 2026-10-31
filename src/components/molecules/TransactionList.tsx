import {RefreshControl, View} from 'react-native';
import React, {memo, useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../i18n/displayNames';
import useThemeColors, {type ThemeColors} from '../../hooks/useThemeColors';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Icon from '../atoms/Icons';
import {flattenDayGroups, groupExpensesByDay, type DayListItem} from '../../utils/groupExpensesByDay';
import {navigate} from '../../utils/navigationUtils';
import type {ExpenseData as ExpenseDocType} from '../../watermelondb/services';
import {useUndoableDelete} from '../../hooks/useUndoableDelete';
import {useDeleteExpense} from '../../hooks/useDeleteExpense';
import PrimaryText from '../atoms/PrimaryText';
import SwipeableRow from '../atoms/SwipeableRow';
import {UndoStrip} from '../atoms/UndoStrip';
import useFormatAmount from '../../hooks/useFormatAmount';
import {FlashList} from '@shopify/flash-list';
import {gs} from '../../styles/globalStyles';

interface CategoryInfo {
  id?: string;
  name?: string;
  icon?: string;
  color?: string;
}

interface Expense extends ExpenseDocType {
  category?: CategoryInfo;
}

interface TransactionListProps {
  allExpenses: Array<Expense>;
  targetDate?: string;
  targetMonth?: string;
  edgeToEdge?: boolean;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: {paddingBottom?: number};
  tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  /** Called after each layout commit that has rows on screen (Home's start-up marker). */
  onRowsCommitted?: () => void;
}

interface ExpenseRowProps {
  expense: Expense;
  colors: ThemeColors;
  onEdit: (expense: Expense) => void;
  /** With the card's measured height, so the undo strip can take its place exactly. */
  onDelete: (expenseId: string, cardHeight: number) => void;
  openSwipeableRef: React.RefObject<{close: () => void} | null>;
  edgeToEdge: boolean;
  tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  dayLabel: string;
}

type ListItem = DayListItem<Expense>;

const keyExtractor = (item: ListItem): string => item.key;
const getItemType = (item: ListItem): string => item.type;

const ExpenseRow: React.FC<ExpenseRowProps> = React.memo(
  ({expense, colors, onEdit, onDelete, openSwipeableRef, edgeToEdge, tutorialSwipeRef, dayLabel}) => {
    const {t} = useTranslation();
    const formatAmount = useFormatAmount();
    const categoryName = expense.category?.name ? displayCategoryName(expense.category.name, t) : undefined;

    const handleEdit = useCallback(() => {
      onEdit(expense);
    }, [onEdit, expense]);

    // Written on layout, read on delete: a ref, so measuring never re-renders the row.
    const cardHeight = useRef(0);
    const handleDelete = useCallback(() => {
      onDelete(String(expense.id), cardHeight.current);
    }, [onDelete, expense.id]);

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          rowKey={String(expense.id)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          menuTitle={expense.title}
          accessibilityLabel={[expense.title, formatAmount(expense.amount), categoryName, expense.description, dayLabel]
            .filter(Boolean)
            .join(', ')}
          colors={colors}
          swipeRef={tutorialSwipeRef}
          openSwipeableRef={openSwipeableRef}
          edgeToEdge={edgeToEdge}>
          <View
            onLayout={event => {
              cardHeight.current = event.nativeEvent.layout.height;
            }}
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
                  name={expense.category?.icon || 'circle-dot'}
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
            <View style={gs.ml10}>
              <PrimaryText size={14} weight="semibold" variant="number">
                {formatAmount(expense.amount)}
              </PrimaryText>
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  },
);

const DayHeader: React.FC<{label: string; total: number; colors: ThemeColors; edgeToEdge: boolean}> = memo(
  ({label, total, colors, edgeToEdge}) => {
    const formatAmount = useFormatAmount();
    return (
      <View style={[gs.rowBetweenCenter, gs.mb8, gs.mt15, edgeToEdge && gs.px16]}>
        <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
          {label}
        </PrimaryText>
        <PrimaryText size={12} weight="semibold" color={colors.secondaryText} variant="number">
          {formatAmount(total)}
        </PrimaryText>
      </View>
    );
  },
);

/**
 * One flat FlashList of day headers and rows (S7, v2.7.1). The previous
 * shape rendered every row of a day inside one list item, so the list could
 * only recycle whole days and each day kept its own undo state — and a
 * second swipe-delete within a day cancelled the first (M4). Undo windows now
 * live in one `createPendingDeletes` per list, one timer per row.
 */
const TransactionList: React.FC<TransactionListProps> = ({
  allExpenses,
  targetDate,
  targetMonth,
  edgeToEdge = false,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshing,
  onRefresh,
  contentContainerStyle,
  tutorialSwipeRef,
  onRowsCommitted,
}) => {
  const colors = useThemeColors();
  const openSwipeableRef = useRef<{close: () => void} | null>(null);

  const {commit, onCommitFailed} = useDeleteExpense({targetMonth, targetDate});
  const presentIds = useMemo(() => (allExpenses ?? []).map(e => String(e.id)), [allExpenses]);
  const {pendingIds, removedIds, schedule, undo} = useUndoableDelete({commit, onCommitFailed, presentIds});

  const handleEdit = useCallback((expense: Expense) => {
    navigate('UpdateTransactionScreen', {expenseId: String(expense.id)});
  }, []);

  // The deleted rows' card heights, for their undo strips.
  const [undoHeights, setUndoHeights] = useState<ReadonlyMap<string, number>>(() => new Map());
  const handleDelete = useCallback(
    (expenseId: string, cardHeight: number) => {
      if (cardHeight > 0) {
        setUndoHeights(prev => new Map(prev).set(expenseId, cardHeight));
      }
      schedule(expenseId);
    },
    [schedule],
  );
  const handleUndo = undo;

  const groupedData = useMemo(() => groupExpensesByDay(allExpenses ?? []), [allExpenses]);
  const listData: ListItem[] = useMemo(
    () => flattenDayGroups(groupedData, pendingIds, removedIds),
    [groupedData, pendingIds, removedIds],
  );

  const renderItem = useCallback(
    ({item}: {item: ListItem}) => {
      if (item.type === 'header') {
        return <DayHeader label={item.label} total={item.total} colors={colors} edgeToEdge={edgeToEdge} />;
      }
      if (item.pending) {
        return (
          <UndoStrip
            id={String(item.row.id)}
            colors={colors}
            onUndo={handleUndo}
            edgeToEdge={edgeToEdge}
            rowHeight={undoHeights.get(String(item.row.id))}
          />
        );
      }
      return (
        <ExpenseRow
          expense={item.row}
          colors={colors}
          onEdit={handleEdit}
          onDelete={handleDelete}
          openSwipeableRef={openSwipeableRef}
          edgeToEdge={edgeToEdge}
          tutorialSwipeRef={item.isFirstRow ? tutorialSwipeRef : undefined}
          dayLabel={item.dayLabel}
        />
      );
    },
    [colors, edgeToEdge, handleUndo, handleEdit, handleDelete, tutorialSwipeRef, undoHeights],
  );

  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined),
    [refreshing, onRefresh],
  );

  return (
    <FlashList
      data={listData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
      onCommitLayoutEffect={listData.length > 0 ? onRowsCommitted : undefined}
    />
  );
};

export default memo(TransactionList);
