import {ScrollView, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../../../i18n/displayNames';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import defaultCategories from '../../../../../assets/jsons/defaultCategories.json';
import {usePickCategories} from './usePickCategories';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Icon} from '../../../../ui/atoms/Icons';
import {gs} from '../../../../ui/globalStyles';
import {logRejection} from '../../../../platform/errorLog';
import type {CategoryChoice} from '../../../../domain/types';

export const PickCategoriesScreen = () => {
  const {colors, handleSkip, handleSubmit, isSubmitting, toggleCategorySelection, isCategorySelected} =
    usePickCategories();
  const {t} = useTranslation();

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween}>
      <View style={gs.flex1}>
        <TouchableOpacity
          style={[gs.selfEnd, gs.mt5p, gs.minTouch, gs.px10]}
          onPress={handleSkip}
          accessibilityRole="button">
          <PrimaryText size={13} weight="medium" color={colors.secondaryText}>
            {t('common.skip')}
          </PrimaryText>
        </TouchableOpacity>

        <View style={gs.pt10p}>
          <PrimaryText size={28} weight="bold">
            {t('onboarding.title')}
          </PrimaryText>
          <PrimaryText size={28} weight="bold">
            {t('onboarding.titleSuffix')}
          </PrimaryText>
        </View>

        <PrimaryText size={14} color={colors.secondaryText} style={[gs.mt6, gs.mb20]}>
          {t('onboarding.subtitle')}
        </PrimaryText>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[gs.row, gs.wrap, gs.pb80]}>
          {defaultCategories?.map((category: CategoryChoice) => {
            const isSelected = isCategorySelected(category.name);

            return (
              <TouchableOpacity
                key={category.name}
                onPress={() => toggleCategorySelection(category)}
                // As CategoryContainer's chip: a button that is selected or not, named by its category.
                accessibilityRole="button"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={displayCategoryName(category.name, t)}
                activeOpacity={0.7}>
                <View
                  style={[
                    gs.py8,
                    gs.minTouch,
                    gs.px14,
                    gs.mr8,
                    gs.mt10,
                    gs.rounded12,
                    gs.rowCenter,
                    gs.gap6,
                    {
                      backgroundColor: isSelected ? colors.primaryText : colors.secondaryAccent,
                    },
                  ]}>
                  {category.icon !== undefined && (
                    <Icon
                      dynamicName={category.icon}
                      size={16}
                      color={isSelected ? colors.buttonText : (category.color ?? colors.secondaryText)}
                    />
                  )}
                  <PrimaryText
                    size={13}
                    weight={isSelected ? 'semibold' : 'regular'}
                    color={isSelected ? colors.buttonText : colors.primaryText}>
                    {displayCategoryName(category.name, t)}
                  </PrimaryText>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <PrimaryButton
        onPress={() => logRejection(handleSubmit())}
        colors={colors}
        buttonTitle={t('common.continue')}
        disabled={isSubmitting}
      />
    </PrimaryView>
  );
};
