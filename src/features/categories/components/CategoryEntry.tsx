import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, memo} from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../ui/atoms/AppHeader';
import {CustomInput} from '../../../ui/atoms/CustomInput';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Icon} from '../../../ui/atoms/Icons';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {goBack} from '../../../platform/navigationUtils';
import {categorySchema} from '../../../i18n/validationSchema';
import {displayCategoryName} from '../../../i18n/displayNames';
import {SheetManager} from 'react-native-actions-sheet';
import {logRejection} from '../../../platform/errorLog';
import {gs} from '../../../ui/globalStyles';
import {useCategoryForm, type EditedCategory} from '../hooks/useCategoryForm';
import type {CategoryChoice} from '../../../domain/types';

interface CategoryEntryProps {
  /** The category being edited; absent when adding one. */
  editing?: EditedCategory;
}

const CategoryEntryComponent: React.FC<CategoryEntryProps> = ({editing}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {
    categoryName,
    setCategoryName,
    selectedIcon,
    setSelectedIcon,
    selectedColor,
    setSelectedColor,
    selectedCategories,
    selectedCategoryNames,
    toggleCategorySelection,
    filteredCategories,
    isDuplicate,
    isValid,
    save,
  } = useCategoryForm(editing);

  const handleOpenIconPicker = useCallback(() => {
    void SheetManager.show('icon-picker-sheet', {
      payload: {
        selectedIcon: selectedIcon ?? undefined,
        onSelect: (icon: string) => {
          setSelectedIcon(icon);
          void SheetManager.hide('icon-picker-sheet');
        },
      },
    });
  }, [selectedIcon, setSelectedIcon]);

  const handleOpenColorPicker = useCallback(() => {
    void SheetManager.show('color-picker-sheet', {
      payload: {
        selectedColor: selectedColor ?? undefined,
        onSelect: (color: string) => {
          setSelectedColor(color);
          void SheetManager.hide('color-picker-sheet');
        },
      },
    });
  }, [selectedColor, setSelectedColor]);

  const renderDefaultCategoryItem = useCallback(
    (category: CategoryChoice) => {
      const isSelected = selectedCategoryNames.has(category.name);

      return (
        <TouchableOpacity
          key={category.name}
          onPress={() => toggleCategorySelection(category)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{selected: isSelected}}
          accessibilityLabel={displayCategoryName(category.name, t)}>
          <View
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.mr8,
              gs.mt5,
              gs.rounded12,
              gs.rowCenter,
              gs.gap6,
              {backgroundColor: isSelected ? colors.primaryText : colors.secondaryAccent},
            ]}>
            {category.icon ? (
              <Icon
                dynamicName={category.icon}
                size={16}
                color={isSelected ? colors.buttonText : (category.color ?? colors.secondaryText)}
              />
            ) : null}
            <PrimaryText
              size={13}
              weight={isSelected ? 'semibold' : 'regular'}
              numberOfLines={1}
              style={gs.maxW220}
              color={isSelected ? colors.buttonText : colors.primaryText}>
              {displayCategoryName(category.name, t)}
            </PrimaryText>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, selectedCategoryNames, toggleCategorySelection, t],
  );

  return (
    <PrimaryView colors={colors}>
      <FormScroll contentStyle={gs.justifyBetween}>
        <View>
          <View style={[gs.mb20, gs.mt20]}>
            <AppHeader
              onPress={goBack}
              colors={colors}
              text={editing ? t('category.editTitle') : t('category.addTitle')}
            />
          </View>

          <CustomInput
            colors={colors}
            input={categoryName}
            setInput={setCategoryName}
            placeholder={t('category.namePlaceholder')}
            label={t('category.nameLabel')}
            schema={categorySchema}
            externalError={isDuplicate ? t('validation.duplicateCategory') : undefined}
          />

          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
            {t('category.appearanceLabel')}
          </PrimaryText>
          <View style={[gs.row, gs.gap8, gs.mb15]}>
            <TouchableOpacity
              onPress={handleOpenIconPicker}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={[
                gs.py10,
                gs.px14,
                gs.rounded12,
                gs.rowCenter,
                gs.gap8,
                gs.flex1,
                {backgroundColor: colors.secondaryAccent},
              ]}>
              <View style={[gs.size32, gs.roundedFull, gs.center, {backgroundColor: colors.containerColor}]}>
                <Icon dynamicName={selectedIcon ?? 'shapes'} size={16} color={colors.primaryText} />
              </View>
              <View style={gs.flex1}>
                <PrimaryText size={11} color={colors.secondaryText}>
                  {t('category.iconLabel')}
                </PrimaryText>
                <PrimaryText size={13} weight="medium">
                  {selectedIcon ? t('common.change') : t('common.choose')}
                </PrimaryText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenColorPicker}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={[
                gs.py10,
                gs.px14,
                gs.rounded12,
                gs.rowCenter,
                gs.gap8,
                gs.flex1,
                {backgroundColor: colors.secondaryAccent},
              ]}>
              <View
                style={[gs.size32, gs.roundedFull, gs.center, {backgroundColor: selectedColor ?? colors.accentGreen}]}
              />
              <View style={gs.flex1}>
                <PrimaryText size={11} color={colors.secondaryText}>
                  {t('category.colorLabel')}
                </PrimaryText>
                <PrimaryText size={13} weight="medium">
                  {selectedColor ? t('common.change') : t('common.choose')}
                </PrimaryText>
              </View>
            </TouchableOpacity>
          </View>

          {filteredCategories.length !== 0 && !editing ? (
            <>
              <View style={[gs.rowCenter, gs.gap8, gs.mb8]}>
                <View style={[gs.flex1, gs.hairline, {backgroundColor: colors.secondaryAccent}]} />
                <PrimaryText size={11} color={colors.secondaryText}>
                  {t('category.orPickFromDefaults')}
                </PrimaryText>
                <View style={[gs.flex1, gs.hairline, {backgroundColor: colors.secondaryAccent}]} />
              </View>
              {/* Wrapped, not a non-scrolling horizontal list: ten chips in one
                row overflowed narrow phones and the last ones could not be
                reached at all (bug sheet #12). */}
              <View style={[gs.row, gs.wrap, gs.mt5]}>{filteredCategories.map(renderDefaultCategoryItem)}</View>
            </>
          ) : null}
        </View>

        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={editing ? t('common.update') : t('common.add')}
          // A duplicate typed name blocks saving even when chips are picked:
          // otherwise the chips would save and the typed name silently would not.
          disabled={isDuplicate || (!isValid && selectedCategories.length === 0)}
        />
      </FormScroll>
    </PrimaryView>
  );
};

export const CategoryEntry = memo(CategoryEntryComponent);
