import React, {forwardRef, useCallback} from 'react';
import {StyleProp, TextInput, View, ViewStyle, type ReturnKeyTypeOptions} from 'react-native';
import PrimaryText from './PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {useCurrency} from '../../hooks/useCurrency';
import {getCurrencyDecimals, isCurrencySymbolSuffix} from '../../utils/numberUtils';
import {normalizeAmountInput} from '../../utils/amountInput';
import {gs} from '../../styles/globalStyles';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  /** Outer container additions (e.g. the error-dependent bottom margin). */
  style?: StyleProp<ViewStyle>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}

/**
 * Amount input with the currency symbol on the side the user's locale puts it
 * — "$ 1234" but "1234 kr". Previously ExpenseEntry and DebtEntry each
 * hardcoded the symbol as a prefix, disagreeing with the (already
 * locale-correct) formatted display strings for suffix currencies.
 */
type TextInputHandle = React.ElementRef<typeof TextInput>;

const AmountInput = forwardRef<TextInputHandle, AmountInputProps>(
  ({value, onChangeText, onBlur, style, returnKeyType, onSubmitEditing, accessibilityLabel}, ref) => {
    const colors = useThemeColors();
    const {symbol: currencySymbol, code: currencyCode} = useCurrency();
    const suffix = isCurrencySymbolSuffix(currencyCode);
    // The currency's own precision: a yen has no decimals, a dinar has three.
    // Extra digits are dropped as they are typed so what is shown is storable.
    const decimals = getCurrencyDecimals(currencyCode);

    // Numeric keyboards emit a comma as the decimal key in most of Europe and
    // Latin America; every consumer parses with Number(), which needs a dot.
    // Normalising here means the user sees the dot appear as they type.
    const handleChangeText = useCallback(
      (text: string) => onChangeText(normalizeAmountInput(text, decimals)),
      [onChangeText, decimals],
    );

    const symbol = (
      <PrimaryText size={15} variant="number" color={colors.secondaryText}>
        {currencySymbol}
      </PrimaryText>
    );

    return (
      <View
        style={[
          gs.minH48,
          gs.itemsCenter,
          gs.rounded12,
          gs.row,
          suffix ? gs.pr10 : gs.pl10,
          gs.border1,
          {backgroundColor: colors.secondaryAccent, borderColor: colors.inputBorder},
          style,
        ]}>
        {!suffix && symbol}
        <TextInput
          ref={ref}
          style={[gs.px15, gs.minH48, gs.flex1, gs.numMedium, gs.noFontPadding, {color: colors.primaryText}]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={'0'}
          onBlur={onBlur}
          placeholderTextColor={colors.secondaryText}
          keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel}
        />
        {suffix && symbol}
      </View>
    );
  },
);

AmountInput.displayName = 'AmountInput';

export default React.memo(AmountInput);
