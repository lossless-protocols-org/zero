import {TouchableOpacity, View, type StyleProp, type ViewStyle} from 'react-native';
import React, {useCallback, memo} from 'react';
import {useThemeColors} from '../hooks/useThemeColors';
import {PrimaryText} from '../atoms/PrimaryText';
import {FlashList, type FlashListProps} from '@shopify/flash-list';
import {gs} from '../globalStyles';
import {hexToRgba} from '../colorUtils';

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

interface CurrencySymbolPickerProps {
  filteredCurrencies?: Array<Currency>;
  selectedCurrency?: Partial<Currency> | null;
  handleCurrencySelect: (currency: Currency) => void;
  /**
   * Pass true wherever the grid is the scrolling element (the onboarding
   * screen, and the Settings sheet with the sheet's ScrollView as
   * renderScrollComponent so the drag gesture is shared). A non-scrolling
   * grid inside another ScrollView lays out all 153 cells (S6, v2.7.1).
   */
  scrollEnabled?: boolean;
  renderScrollComponent?: FlashListProps<Currency>['renderScrollComponent'];
  /**
   * Must be set on the list itself: a parent ScrollView's setting does not
   * reach this nested one, so with the keyboard open the first tap on a cell
   * would only dismiss the keyboard.
   */
  keyboardShouldPersistTaps?: FlashListProps<Currency>['keyboardShouldPersistTaps'];
  keyboardDismissMode?: FlashListProps<Currency>['keyboardDismissMode'];
  style?: StyleProp<ViewStyle>;
}

/**
 * The one currency grid, used by onboarding and the Settings sheet. The two
 * used to carry near-identical copies whose styles had drifted apart.
 */
const CurrencySymbolPickerComponent: React.FC<CurrencySymbolPickerProps> = ({
  filteredCurrencies,
  selectedCurrency,
  handleCurrencySelect,
  scrollEnabled = false,
  renderScrollComponent,
  keyboardShouldPersistTaps,
  keyboardDismissMode,
  style,
}) => {
  const colors = useThemeColors();

  const renderCurrencyItem = useCallback(
    ({item: currency}: {item: Currency}) => {
      const isSelected = selectedCurrency?.code === currency.code;
      return (
        <TouchableOpacity
          onPress={() => handleCurrencySelect(currency)}
          accessibilityRole="button"
          accessibilityState={{selected: isSelected}}
          accessibilityLabel={`${currency.name} (${currency.code})`}>
          <View
            style={[
              gs.flex1,
              gs.minH80,
              gs.mr6,
              gs.mt6,
              gs.rounded8,
              gs.border2,
              gs.p8,
              gs.justifyEvenly,
              {
                backgroundColor: isSelected ? hexToRgba(colors.accentGreen, 0.25) : colors.secondaryAccent,
                borderColor: isSelected ? colors.accentGreen : colors.secondaryContainerColor,
              },
            ]}>
            <View style={gs.rowBetweenCenter}>
              <PrimaryText size={20} color={colors.primaryText} variant="number">
                {currency.symbol}
              </PrimaryText>
              <PrimaryText size={13} color={colors.primaryText}>
                {currency.code}
              </PrimaryText>
            </View>
            <PrimaryText size={10} color={colors.primaryText} numberOfLines={2}>
              {currency.name}
            </PrimaryText>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, selectedCurrency, handleCurrencySelect],
  );

  return (
    <View style={[gs.wFull, gs.mb10, gs.minH2, style]}>
      <FlashList
        data={filteredCurrencies}
        renderItem={renderCurrencyItem}
        numColumns={3}
        keyExtractor={item => item.code}
        scrollEnabled={scrollEnabled}
        renderScrollComponent={renderScrollComponent}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        extraData={selectedCurrency?.code}
      />
    </View>
  );
};

export const CurrencySymbolPicker = memo(CurrencySymbolPickerComponent);
