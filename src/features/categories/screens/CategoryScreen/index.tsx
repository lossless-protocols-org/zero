import {RefreshControl, ScrollView, View} from 'react-native';
import {AddFab} from '../../../../ui/atoms/AddFab';
import {SegmentedTabs} from '../../../../ui/atoms/SegmentedTabs';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../../../i18n/displayNames';
import {navigate} from '../../../../platform/navigationUtils';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {useCategory} from './useCategory';
import {useSwipeTutorial} from '../../../../ui/hooks/useSwipeTutorial';
import {SwipeTutorialTooltip} from '../../../../ui/atoms/SwipeTutorialTooltip';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import type {CategoryKind} from '../../../../domain/types';
import type {OrderMove} from '../../../../domain/categoryOrder';
import {CategoryData as Category} from '../../../../domain/types';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {FlashList, type FlashListRef} from '@shopify/flash-list';

const NO_ANCHOR = {disabled: true};
import {gs} from '../../../../ui/globalStyles';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {logRejection} from '../../../../platform/errorLog';
import {ReorderList, type ReorderItem} from '../../components/ReorderList';
import {CategoryRow} from '../../components/CategoryRow';
import {ReorderToolbar} from '../../components/ReorderToolbar';

/** A category with its place in its kind's list. */
type ListItem = {key: string; category: Category; isFirst: boolean; isLast: boolean; canDelete: boolean};

const keyExtractor = (item: ListItem): string => item.key;

export const CategoryScreen = () => {
  const {
    colors,
    refreshing,
    onRefresh,
    categories,
    incomeCategories,
    handleEdit,
    handleDelete,
    handleMove,
    handleReorder,
  } = useCategory();
  const {t} = useTranslation();
  // One kind at a time (owner, 2.8): Income no longer hides under a long expense list.
  const [kind, setKind] = useState<CategoryKind>('expense');
  // Reorder mode (2.8): the same categories as drag handles; every drop is saved.
  const [reordering, setReordering] = useState(false);
  const rows = kind === 'income' ? incomeCategories : categories;
  const canReorder = rows.length > 1;
  const openSwipeableRef = useRef<{close: () => void} | null>(null);
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'category',
    itemCount: categories.length,
  });

  const switchKind = useCallback((next: CategoryKind) => {
    setReordering(false);
    setKind(next);
  }, []);

  const listData = useMemo<ListItem[]>(
    () =>
      rows.map((category, i) => ({
        key: category.id,
        category,
        isFirst: i === 0,
        isLast: i === rows.length - 1,
        // Money in always needs a category: the last income one stays.
        canDelete: kind === 'expense' || rows.length > 1,
      })),
    [rows, kind],
  );

  const onDelete = useCallback((id: string) => logRejection(handleDelete(id)), [handleDelete]);
  const reorderItems = useMemo<ReorderItem[]>(
    () => rows.map(c => ({id: c.id, label: displayCategoryName(c.name, t), icon: c.icon ?? '', color: c.color})),
    [rows, t],
  );
  const onReorder = useCallback((ids: string[]) => logRejection(handleReorder(kind, ids)), [handleReorder, kind]);

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const onMove = useCallback(
    (moveKind: CategoryKind, id: string, move: OrderMove) => {
      // Moved to the top from further down: go there to show where it went. The
      // list keeps its offset otherwise (NO_ANCHOR), so the row just vanished
      // from view (Moto, 2026-11-09). Up and down keep it on screen.
      if (move === 'top') {
        listRef.current?.scrollToOffset({offset: 0, animated: true});
      }
      logRejection(handleMove(moveKind, id, move));
    },
    [handleMove],
  );

  const renderCategoryItem = useCallback(
    ({item, index}: {item: ListItem; index: number}) => (
      <CategoryRow
        category={item.category}
        colors={colors}
        onEdit={handleEdit}
        onDelete={item.canDelete ? onDelete : undefined}
        onMove={onMove}
        isFirst={item.isFirst}
        isLast={item.isLast}
        openSwipeableRef={openSwipeableRef}
        tutorialSwipeRef={index === 0 && kind === 'expense' ? tutorialRef : undefined}
      />
    ),
    [colors, handleEdit, onDelete, onMove, tutorialRef, kind],
  );

  // A failed load is not "no categories yet": the banner says so.
  const categoryError = useDataError(['category']);
  const ListEmptyComponent = useCallback(
    () => (categoryError ? null : <EmptyState colors={colors} type={'Categories'} style={gs.mt30p} />),
    [colors, categoryError],
  );

  const toolbar = (
    <ReorderToolbar
      reordering={reordering}
      canReorder={canReorder}
      onToggle={() => setReordering(r => !r)}
      colors={colors}
    />
  );

  const incomeNote =
    kind === 'income' ? (
      <View style={[gs.px14, gs.py12, gs.rounded12, gs.mb10, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={12} color={colors.secondaryText}>
          {t('categories.incomeFreeNote')}
        </PrimaryText>
      </View>
    ) : null;

  return (
    <>
      <PrimaryView colors={colors} useSidePadding={false} useBottomPadding={false}>
        <View style={[gs.mb15, gs.px16]}>
          <HeaderContainer headerText={t('categories.title')} />
        </View>
        <View style={gs.px16}>
          <DataErrorBanner domains={['category']} />
          <View style={gs.mb10}>
            <SegmentedTabs<CategoryKind>
              tabs={[
                {key: 'expense', label: t('categories.tabExpense'), count: categories.length},
                {key: 'income', label: t('categories.tabIncome'), count: incomeCategories.length},
              ]}
              value={kind}
              onChange={switchKind}
              colors={colors}
            />
          </View>
          {incomeNote}
          {toolbar}
        </View>
        {shouldShowTutorial && kind === 'expense' && !reordering ? (
          <SwipeTutorialTooltip onDismiss={dismissTutorial} />
        ) : null}
        {reordering ? (
          <ScrollView contentContainerStyle={[gs.px16, gs.pb100]} showsVerticalScrollIndicator={false}>
            <ReorderList items={reorderItems} colors={colors} onReorder={onReorder} />
          </ScrollView>
        ) : (
          // Unmounted while reordering: kept hidden, every drop re-rendered all its swipeable rows (Moto jank).
          <View style={gs.flex1}>
            <FlashList
              ref={listRef}
              data={listData}
              renderItem={renderCategoryItem}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              // Off for a list the user reorders: FlashList keeps the first visible row in
              // place when the data changes, so "Move to top" put the category above the
              // screen and the move looked like it had done nothing (found on the Moto,
              // 2026-11-09). The scroll offset stays where it was instead.
              maintainVisibleContentPosition={NO_ANCHOR}
              ListEmptyComponent={ListEmptyComponent}
              contentContainerStyle={{...gs.px16, ...gs.pb100}}
            />
          </View>
        )}
      </PrimaryView>
      {/* Expense categories only: Free has one income category (rename it; more come with Pro).
          Hidden while reordering: it sat over the last rows' grips. */}
      <AddFab
        kind="category"
        onPress={() => navigate('AddCategoryScreen')}
        label={t('categories.addCategory')}
        colors={colors}
        hidden={reordering || kind === 'income'}
      />
    </>
  );
};
