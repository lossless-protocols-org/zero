import {Keyboard, TextInput, View, useWindowDimensions} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps, ScrollView as SheetScrollView} from 'react-native-actions-sheet';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryButton from '../components/atoms/PrimaryButton';
import CurrencySymbolPicker from '../components/molecules/CurrencySymbolPicker';
import Icon from '../components/atoms/Icons';
import currencies from '../../assets/jsons/currencies.json';
import {filterCurrencies} from '../utils/currencySearch';
import {gs} from '../styles/globalStyles';

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CurrencyPickerSheet: React.FC<SheetProps<'currency-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {height: screenHeight} = useWindowDimensions();
  const initialCurrency = props.payload?.selectedCurrency;
  const [searchText, setSearchText] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(initialCurrency || null);

  const filteredCurrencies = useMemo(() => filterCurrencies(currencies, searchText), [searchText]);

  const handleCurrencySelect = useCallback((currency: Currency) => {
    setSelectedCurrency(currency);
    // Same as onboarding (S6, v2.7.1): picking ends the search and reveals Update.
    Keyboard.dismiss();
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedCurrency) {
      props.payload?.onSelect?.(selectedCurrency);
    }
    void SheetManager.hide(props.sheetId);
  }, [props, selectedCurrency]);

  const handleClose = useCallback(() => {
    setSearchText('');
  }, []);

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectCurrency'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      onClose={handleClose}
      gestureEnabled>
      <View style={[gs.px15, gs.pb10]}>
        <View
          style={[
            gs.minH48,
            gs.itemsCenter,
            gs.border2,
            gs.mt5,
            gs.mb15,
            gs.rounded10,
            gs.pl10,
            gs.justifyStart,
            gs.row,
            {borderColor: colors.secondaryContainerColor, backgroundColor: colors.secondaryAccent},
          ]}>
          <Icon name="search" size={20} color={colors.primaryText} />
          <TextInput
            style={[gs.px15, gs.minH48, gs.wFull, gs.fontMedium, gs.noFontPadding, {color: colors.primaryText}]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('sheets.searchCurrency')}
            placeholderTextColor={colors.secondaryText}
          />
        </View>

        <CurrencySymbolPicker
          filteredCurrencies={filteredCurrencies}
          selectedCurrency={selectedCurrency}
          handleCurrencySelect={handleCurrencySelect}
          scrollEnabled
          renderScrollComponent={SheetScrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={[gs.my10, {height: screenHeight * 0.42}]}
        />

        <PrimaryButton
          onPress={handleConfirm}
          colors={colors}
          buttonTitle={t('common.update')}
          disabled={!selectedCurrency}
        />
      </View>
    </CustomBottomSheet>
  );
});

export default CurrencyPickerSheet;
