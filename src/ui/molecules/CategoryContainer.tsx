import {TouchableOpacity, View} from 'react-native';
import React from 'react';
import {Icon} from '../atoms/Icons';
import {PrimaryText} from '../atoms/PrimaryText';
import type {ThemeColors} from '../hooks/useThemeColors';
import type {CategoryChoice} from '../../domain/types';
import {gs} from '../globalStyles';
import {useTranslation} from 'react-i18next';
import {displayCategoryName, displayDebtAccountName} from '../../i18n/displayNames';

/** A chip: a saved category (with its id) or a choice not saved yet (onboarding, the defaults list). */
type Category = CategoryChoice & {id?: string};

interface CategoryContainerProps {
  categories: Array<Category>;
  toggleCategorySelection(category: Category): void;
  colors: ThemeColors;
  selectedCategories: Array<Category>;
  /** Which seeded names to translate: expense categories (default) or debt account types. */
  nameKind?: 'category' | 'debtAccount';
  /** One line (inside a horizontal scroll) instead of wrapping. */
  nowrap?: boolean;
}

export const CategoryContainer: React.FC<CategoryContainerProps> = React.memo(
  ({categories, colors, toggleCategorySelection, selectedCategories, nameKind = 'category', nowrap = false}) => {
    const {t} = useTranslation();
    const displayName = nameKind === 'debtAccount' ? displayDebtAccountName : displayCategoryName;
    return (
      <View style={nowrap ? gs.row : [gs.row, gs.wrap]}>
        {categories.map(category => {
          const isSelected = category?.name === selectedCategories[0]?.name;

          return (
            <TouchableOpacity
              key={category.id ?? category.name}
              onPress={() => toggleCategorySelection(category)}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
              accessibilityLabel={displayName(category.name, t)}
              activeOpacity={0.7}>
              <View
                style={[
                  gs.py8,
                  gs.minTouch,
                  gs.px14,
                  gs.mr8,
                  gs.mb8,
                  gs.rounded12,
                  gs.rowCenter,
                  gs.gap6,
                  {backgroundColor: isSelected ? colors.primaryText : colors.secondaryAccent},
                ]}>
                {!!category.icon && (
                  <Icon
                    dynamicName={category.icon}
                    size={16}
                    color={isSelected ? colors.buttonText : category.color || colors.secondaryText}
                  />
                )}
                {/* Names can now be 40 characters: cap the chip so one long
                    name cannot push the row off-screen. */}
                <PrimaryText
                  size={13}
                  weight={isSelected ? 'semibold' : 'regular'}
                  numberOfLines={1}
                  style={gs.maxW220}
                  color={isSelected ? colors.buttonText : colors.primaryText}>
                  {displayName(category.name, t)}
                </PrimaryText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  },
);
