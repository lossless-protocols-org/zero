import {RefreshControlProps, View} from 'react-native';
import React, {useCallback, useMemo, useRef, memo} from 'react';
import {useTranslation} from 'react-i18next';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type {DebtData as Debt} from '../../../domain/types';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {SwipeableRow} from '../../../ui/atoms/SwipeableRow';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {displayDebtDescription} from '../../../i18n/displayNames';
import {flattenDayGroups, groupExpensesByDay, type DayListItem} from '../../../ui/groupExpensesByDay';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {FlashList} from '@shopify/flash-list';
import {gs} from '../../../ui/globalStyles';
import {EmptyState} from '../../../ui/atoms/EmptyState';

interface DebtListProps {
  colors: ThemeColors;
  handleEditDebt: (debtId: string) => void;
  handleDeleteDebt: (debtId: string) => void;
  individualDebts: Array<Debt>;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
}

type ListItem = DayListItem<Debt>;

const NO_IDS: ReadonlySet<string> = new Set();
const keyExtractor = (item: ListItem): string => item.key;
const getItemType = (item: ListItem): string => item.type;

const DebtRow = memo(
  ({
    debt,
    colors,
    onEdit,
    onDelete,
    openSwipeableRef,
    tutorialSwipeRef,
  }: {
    debt: Debt;
    colors: ThemeColors;
    onEdit: (debt: Debt) => void;
    onDelete: (debtId: string) => void;
    openSwipeableRef: React.RefObject<{close: () => void} | null>;
    tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  }) => {
    const {t} = useTranslation();
    const formatAmount = useFormatAmount();
    const description = displayDebtDescription(debt.description, t);

    const handleEdit = useCallback(() => {
      onEdit(debt);
    }, [onEdit, debt]);

    const handleDelete = useCallback(() => {
      onDelete(String(debt.id));
    }, [onDelete, debt.id]);

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          rowKey={String(debt.id)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          menuTitle={description}
          accessibilityLabel={t('debts.rowLabel', {
            description,
            amount: formatAmount(debt.amount),
            date: formatDisplayDate(debt.date, 'date'),
          })}
          colors={colors}
          swipeRef={tutorialSwipeRef}
          openSwipeableRef={openSwipeableRef}
          edgeToEdge>
          <View
            style={[
              gs.rounded12,
              gs.rowBetweenCenter,
              gs.px14,
              gs.py10,
              gs.mx16,
              {backgroundColor: colors.containerColor},
            ]}>
            <View style={[gs.flex1, gs.gap2]}>
              <PrimaryText weight="medium" numberOfLines={1}>
                {description}
              </PrimaryText>
              <PrimaryText size={11} color={colors.secondaryText}>
                {formatDisplayDate(debt.date, 'date')}
              </PrimaryText>
            </View>
            <View style={gs.ml10}>
              <Amount size={14} weight="semibold">
                {formatAmount(debt.amount)}
              </Amount>
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  },
);

/** Flat day headers + rows, as TransactionList (S7, v2.7.1); deletes are the parent's. */
const DebtListComponent: React.FC<DebtListProps> = ({
  colors,
  handleEditDebt,
  handleDeleteDebt,
  individualDebts,
  ListHeaderComponent,
  refreshControl,
  tutorialSwipeRef,
}) => {
  const {t} = useTranslation();
  const openSwipeableRef = useRef<{close: () => void} | null>(null);

  const listData: ListItem[] = useMemo(
    () => flattenDayGroups(groupExpensesByDay(individualDebts ?? []), NO_IDS, NO_IDS),
    [individualDebts],
  );

  const onEdit = useCallback(
    (debt: Debt) => {
      handleEditDebt(String(debt.id));
    },
    [handleEditDebt],
  );

  const onDelete = useCallback(
    (debtId: string) => {
      handleDeleteDebt(debtId);
    },
    [handleDeleteDebt],
  );

  const renderItem = useCallback(
    ({item}: {item: ListItem}) =>
      item.type === 'header' ? (
        <PrimaryText size={12} weight="semibold" color={colors.secondaryText} style={[gs.mb8, gs.mt15, gs.px16]}>
          {item.label}
        </PrimaryText>
      ) : (
        <DebtRow
          debt={item.row}
          colors={colors}
          onEdit={onEdit}
          onDelete={onDelete}
          openSwipeableRef={openSwipeableRef}
          tutorialSwipeRef={item.isFirstRow ? tutorialSwipeRef : undefined}
        />
      ),
    [colors, onEdit, onDelete, tutorialSwipeRef],
  );

  const ListEmpty = useCallback(
    () => <EmptyState type="Debts" colors={colors} message={t('debts.noEntriesYet')} />,
    [colors, t],
  );

  return (
    <View style={gs.flex1}>
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmpty}
        refreshControl={refreshControl}
        contentContainerStyle={gs.pb100}
      />
    </View>
  );
};

export const DebtList = memo(DebtListComponent);
