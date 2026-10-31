import {RefreshControl, View} from 'react-native';
import {TouchableOpacity} from 'react-native-gesture-handler';
import React, {useCallback, useRef, memo} from 'react';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../i18n/displayNames';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {navigate} from '../../utils/navigationUtils';
import Icon from '../../components/atoms/Icons';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import useCategory from './useCategory';
import useSwipeTutorial from '../../hooks/useSwipeTutorial';
import SwipeTutorialTooltip from '../../components/atoms/SwipeTutorialTooltip';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import SwipeableRow from '../../components/atoms/SwipeableRow';
import {CategoryData as Category} from '../../watermelondb/services';
import EmptyState from '../../components/atoms/EmptyState';
import type {ThemeColors} from '../../hooks/useThemeColors';
import {FlashList} from '@shopify/flash-list';
import {gs, hitSlop} from '../../styles/globalStyles';
import {hexToRgba} from '../../utils/colorUtils';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {useDataError} from '../../hooks/useDataError';
import {logRejection} from '../../utils/errorLog';

const CategoryRow = memo(
  ({
    category,
    colors,
    onEdit,
    onDelete,
    openSwipeableRef,
    tutorialSwipeRef,
  }: {
    category: Category;
    colors: ThemeColors;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    openSwipeableRef: React.RefObject<{close: () => void} | null>;
    tutorialSwipeRef?: React.RefObject<SwipeableMethods | null>;
  }) => {
    const {t} = useTranslation();
    const name = displayCategoryName(category.name, t);

    const handleEdit = useCallback(() => {
      onEdit(String(category.id));
    }, [onEdit, category.id]);

    const handleDelete = useCallback(() => {
      onDelete(category.id);
    }, [onDelete, category.id]);

    return (
      <View style={gs.mb5}>
        <SwipeableRow
          onEdit={handleEdit}
          onDelete={handleDelete}
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
              <Icon name={category.icon || 'shapes'} size={18} color={category.color || colors.primaryText} />
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

const CategoryScreen = () => {
  const {colors, refreshing, onRefresh, categories, handleEdit, handleDelete} = useCategory();
  const {t} = useTranslation();
  const openSwipeableRef = useRef<{close: () => void} | null>(null);
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'category',
    itemCount: categories.length,
  });

  const renderCategoryItem = useCallback(
    ({item: category, index}: {item: Category; index: number}) => (
      <CategoryRow
        category={category}
        colors={colors}
        onEdit={handleEdit}
        onDelete={id => logRejection(handleDelete(id))}
        openSwipeableRef={openSwipeableRef}
        tutorialSwipeRef={index === 0 ? tutorialRef : undefined}
      />
    ),
    [colors, handleEdit, handleDelete, tutorialRef],
  );

  // A failed load is not "no categories yet": the banner says so.
  const categoryError = useDataError(['category']);
  const ListEmptyComponent = useCallback(
    () => (categoryError ? null : <EmptyState colors={colors} type={'Categories'} style={gs.mt30p} />),
    [colors, categoryError],
  );

  return (
    <>
      <PrimaryView colors={colors} useSidePadding={false} useBottomPadding={false}>
        <View style={[gs.mb15, gs.px16]}>
          <HeaderContainer headerText={t('categories.title')} />
        </View>
        <View style={gs.px16}>
          <DataErrorBanner domains={['category']} />
        </View>
        {shouldShowTutorial && <SwipeTutorialTooltip onDismiss={dismissTutorial} />}
        <View style={gs.flex1}>
          <FlashList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={item => String(item.id)}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={ListEmptyComponent}
            contentContainerStyle={{...gs.px16, ...gs.pb100}}
          />
        </View>
      </PrimaryView>
      <View style={[gs.absolute, gs.bottom15, gs.end15, gs.zIndex1]}>
        <TouchableOpacity
          style={[gs.size50, gs.roundedFull, gs.center, {backgroundColor: colors.primaryText}]}
          onPress={() => navigate('AddCategoryScreen')}
          hitSlop={hitSlop}
          accessibilityLabel={t('categories.addCategory')}
          accessibilityRole="button">
          <Icon name="plus" size={24} color={colors.buttonText} />
        </TouchableOpacity>
      </View>
    </>
  );
};

export default CategoryScreen;
