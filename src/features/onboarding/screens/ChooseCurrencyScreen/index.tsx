import {TextInput, View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {Icon} from '../../../../ui/atoms/Icons';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {useChooseCurrency} from './useChooseCurrency';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {CurrencySymbolPicker} from '../../../../ui/molecules/CurrencySymbolPicker';
import {gs} from '../../../../ui/globalStyles';
import {logRejection} from '../../../../platform/errorLog';

export const ChooseCurrencyScreen = () => {
  const {
    colors,
    search,
    filteredCurrencies,
    selectedCurrency,
    isSubmitting,
    handleCurrencySubmit,
    handleSearch,
    handleCurrencySelect,
  } = useChooseCurrency();
  const {t} = useTranslation();

  return (
    <PrimaryView colors={colors}>
      <View style={gs.pt15p}>
        <PrimaryText size={28} weight="bold">
          {t('chooseCurrency.title')}
        </PrimaryText>
        <PrimaryText size={28} weight="bold">
          {t('chooseCurrency.titleSuffix')}
        </PrimaryText>
      </View>

      <PrimaryText size={14} color={colors.secondaryText} style={gs.mt6}>
        {t('chooseCurrency.subtitle')}
      </PrimaryText>

      <View
        style={[
          gs.minH48,
          gs.itemsCenter,
          gs.mt20,
          gs.mb15,
          gs.rounded12,
          gs.pl10,
          gs.justifyStart,
          gs.row,
          {backgroundColor: colors.secondaryAccent},
        ]}>
        <Icon name="search" size={18} color={colors.secondaryText} />
        <TextInput
          style={[gs.px15, gs.minH48, gs.wFull, gs.fontMedium, gs.noFontPadding, {color: colors.primaryText}]}
          value={search}
          onChangeText={handleSearch}
          placeholder={t('chooseCurrency.searchPlaceholder')}
          placeholderTextColor={colors.secondaryText}
        />
      </View>

      {/* The grid scrolls itself so FlashList virtualises it (S6, v2.7.1); a
          wrapping ScrollView made it lay out all 153 cells. keyboardShouldPersistTaps
          + keyboardDismissMode replace the screen-wide TouchableWithoutFeedback
          (2.6.6): they dismiss the keyboard without taking the touch responder
          away from the list, and a tap on a cell selects it on the first try. */}
      <CurrencySymbolPicker
        filteredCurrencies={filteredCurrencies}
        selectedCurrency={selectedCurrency}
        handleCurrencySelect={handleCurrencySelect}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={gs.flex1}
      />

      <PrimaryButton
        onPress={() => logRejection(handleCurrencySubmit())}
        colors={colors}
        buttonTitle={t('common.continue')}
        disabled={!selectedCurrency || isSubmitting}
      />
    </PrimaryView>
  );
};
