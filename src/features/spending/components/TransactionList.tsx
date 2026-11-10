import {RefreshControl} from 'react-native';
import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {FlashList, type FlashListRef} from '@shopify/flash-list';
import {displayCategoryName} from '../../../i18n/displayNames';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {flattenDayGroups, type DayListItem} from '../../../ui/groupExpensesByDay';
import {usePreference} from '../../../ui/hooks/usePreference';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {useFormatSpend} from '../../../ui/hooks/useFormatSpend';
import {navigate} from '../../../platform/navigationUtils';
import type {ExpenseWithCategory, RefundListRow} from '../../../domain/types';
import {arrangeRows, listSortPreference} from '../listSort';
import {toListRows, type ListRow} from '../listRows';
import {useListDeletion} from '../hooks/useListDeletion';
import {SortChip} from './SortChip';
import {UndoStrip} from './UndoStrip';
import {ExpenseRow} from './ExpenseRow';
import {RefundRow} from './RefundRow';
import {DayHeader} from './DayHeader';

interface TransactionListProps {
  allExpenses: Array<ExpenseWithCategory>;
  /** Refunds dated in the period the list shows; drawn as their own rows. */
  refunds?: readonly RefundListRow[];
  /** How much came back on each expense, for its "refunded" badge. */
  refundedByExpense?: Readonly<Record<string, number>>;
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
  /** Home and the day screen (2.8): a "Sort" chip under the header and the chosen order. Else by date. */
  sortable?: boolean;
}

type ListItem = DayListItem<ListRow>;

const EMPTY_REFUNDS: readonly RefundListRow[] = [];
const EMPTY_REFUNDED: Readonly<Record<string, number>> = {};

const keyExtractor = (item: ListItem): string => item.key;
// Each shape recycles among its own: an undo strip, a refund and an expense
// row are different trees, and a strip recycled into an expense row's cell
// (as before, when pending rows shared the expense type) rebuilt it.
const getItemType = (item: ListItem): string =>
  item.type === 'header' ? 'header' : item.pending ? 'undo' : `row:${item.row.kind}`;

/** FlashList v2 anchors on the first visible row by default; this list moves to the top instead. */
const NO_ANCHOR = {disabled: true};

/**
 * One flat FlashList of day headers and rows (S7, v2.7.1). The previous
 * shape rendered every row of a day inside one list item, so the list could
 * only recycle whole days and each day kept its own undo state — and a
 * second swipe-delete within a day cancelled the first (M4). Undo windows now
 * live in one `createPendingDeletes` per list, one timer per row.
 */
const TransactionListComponent: React.FC<TransactionListProps> = ({
  allExpenses,
  refunds = EMPTY_REFUNDS,
  refundedByExpense = EMPTY_REFUNDED,
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
  sortable = false,
}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  // Read once here and handed to every row, so rows subscribe to nothing (audit 2026-11-08 §8.3).
  const formatAmount = useFormatAmount();
  const formatSpend = useFormatSpend();
  const chosenSort = usePreference(listSortPreference);
  const sort = sortable ? chosenSort : 'date';
  const openSwipeableRef = useRef<{close: () => void} | null>(null);
  const listRef = useRef<FlashListRef<ListItem>>(null);
  // A new order starts at the top (found on the Moto and the iPhone, 2026-11-09:
  // a re-sort landed wherever the row in view now sat, often the month's end).
  // The list no longer anchors on a row (NO_ANCHOR below): on the Moto
  // FlashList's anchoring correction came after this scroll and undid it.
  const shownSort = useRef(sort);
  useEffect(() => {
    if (shownSort.current === sort) {
      return undefined;
    }
    shownSort.current = sort;
    const frame = requestAnimationFrame(() => listRef.current?.scrollToOffset({offset: 0, animated: false}));
    return () => cancelAnimationFrame(frame);
  }, [sort]);

  // Expenses and the period's refunds as one signed list (refunds negative): day headers net.
  const rows = useMemo(
    () => toListRows(allExpenses, refunds, refundedByExpense),
    [allExpenses, refunds, refundedByExpense],
  );
  const presentIds = useMemo(() => rows.map(r => String(r.id)), [rows]);
  const {pendingIds, removedIds, remove, undo, undoHeightOf} = useListDeletion({
    targetMonth,
    targetDate,
    refunds,
    presentIds,
  });

  const handleEdit = useCallback((expense: ExpenseWithCategory) => {
    navigate('UpdateTransactionScreen', {expenseId: String(expense.id)});
  }, []);

  const groupedData = useMemo(
    () => arrangeRows(rows, sort, row => (row.category?.name ? displayCategoryName(row.category.name, t) : '')),
    [rows, sort, t],
  );
  const listData: ListItem[] = useMemo(
    () => flattenDayGroups(groupedData, pendingIds, removedIds),
    [groupedData, pendingIds, removedIds],
  );

  const renderItem = useCallback(
    ({item}: {item: ListItem}) => {
      if (item.type === 'header') {
        const spend = formatSpend(item.total);
        return (
          <DayHeader
            label={item.label}
            spend={spend.text}
            isBack={spend.isBack}
            colors={colors}
            edgeToEdge={edgeToEdge}
          />
        );
      }
      if (item.pending) {
        return (
          <UndoStrip
            id={String(item.row.id)}
            colors={colors}
            onUndo={undo}
            edgeToEdge={edgeToEdge}
            rowHeight={undoHeightOf(String(item.row.id))}
          />
        );
      }
      if (item.row.kind === 'refund') {
        return (
          <RefundRow
            refund={item.row}
            colors={colors}
            onDelete={remove}
            openSwipeableRef={openSwipeableRef}
            edgeToEdge={edgeToEdge}
            dayLabel={item.dayLabel}
            t={t}
            formatAmount={formatAmount}
          />
        );
      }
      return (
        <ExpenseRow
          expense={item.row}
          colors={colors}
          onEdit={handleEdit}
          onDelete={remove}
          openSwipeableRef={openSwipeableRef}
          edgeToEdge={edgeToEdge}
          tutorialSwipeRef={item.isFirstRow ? tutorialSwipeRef : undefined}
          dayLabel={item.dayLabel}
          t={t}
          formatAmount={formatAmount}
        />
      );
    },
    [colors, edgeToEdge, undo, handleEdit, remove, tutorialSwipeRef, undoHeightOf, t, formatAmount, formatSpend],
  );

  const refreshControl = useMemo(
    () => (onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined),
    [refreshing, onRefresh],
  );

  // Title and Amount are one list with no heading: the chip keeps the gap a heading would give
  // (Moto, 2026-11-09: the first row sat flush under the chip).
  const startsWithRow = listData[0] !== undefined && listData[0].type !== 'header';
  // The sort chip sits under the screen's own header, once there is something to sort.
  const header = useMemo(
    () =>
      sortable && rows.length > 1 ? (
        <>
          {ListHeaderComponent}
          <SortChip edgeToEdge={edgeToEdge} spaced={startsWithRow} />
        </>
      ) : (
        ListHeaderComponent
      ),
    [sortable, rows.length, ListHeaderComponent, edgeToEdge, startsWithRow],
  );

  return (
    <FlashList
      ref={listRef}
      data={listData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      ListHeaderComponent={header}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
      onCommitLayoutEffect={listData.length > 0 ? onRowsCommitted : undefined}
      maintainVisibleContentPosition={NO_ANCHOR}
    />
  );
};

export const TransactionList = memo(TransactionListComponent);
