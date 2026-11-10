import React, {forwardRef, useCallback, useId, useState} from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  type ReturnKeyTypeOptions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from './PrimaryText';
import {AMOUNT_FONT_CAP} from './Amount';
import {useThemeColors} from '../hooks/useThemeColors';
import {useCurrency} from '../hooks/useCurrency';
import {useFormatAmount} from '../hooks/useFormatAmount';
import {usePreference} from '../hooks/usePreference';
import {formatNumber, isCurrencySymbolSuffix} from '../../platform/numberFormat';
import {getCurrencyDecimals} from '../../platform/currencyLocale';
import type {AmountOperator} from '../../domain/amountExpression';
import {useAmountCalculator} from '../hooks/useAmountCalculator';
import {AmountOperatorKeys} from './AmountOperatorKeys';
import {calculatorPreference} from '../../platform/calculatorPreference';
import {gs} from '../globalStyles';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  /** Outer container additions (e.g. the error-dependent bottom margin). */
  style?: StyleProp<ViewStyle>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
  /** Focus (and raise the keyboard) on mount. */
  autoFocus?: boolean;
}

/**
 * Amount input with the currency symbol on the side the user's locale puts it
 * — "$ 1234" but "1234 kr". Previously ExpenseEntry and DebtEntry each
 * hardcoded the symbol as a prefix, disagreeing with the (already
 * locale-correct) formatted display strings for suffix currencies.
 *
 * With Settings → "Calculator in amount fields" on (2.8, off by default) the
 * field also takes + − × ÷: it shows the sum, a line under it shows the
 * result, and `value` / `onChangeText` carry only the RESULT, so every form
 * validates and saves an amount exactly as before. "=" or leaving the field
 * replaces the sum with its result.
 */
type TextInputHandle = React.ElementRef<typeof TextInput>;

const CALCULATOR_ERROR = {
  divideByZero: 'calculator.divideByZero',
  negative: 'calculator.negative',
  tooLarge: 'calculator.tooLarge',
} as const;

const OPERATOR_LABEL = {
  '+': 'calculator.plus',
  '−': 'calculator.minus',
  '×': 'calculator.times',
  '÷': 'calculator.divide',
  '=': 'calculator.equals',
} as const satisfies Record<AmountOperator | '=', string>;

const AmountInputComponent = forwardRef<TextInputHandle, AmountInputProps>(
  ({value, onChangeText, onBlur, style, returnKeyType, onSubmitEditing, accessibilityLabel, autoFocus}, ref) => {
    const colors = useThemeColors();
    const {t} = useTranslation();
    const formatAmount = useFormatAmount();
    const calculator = usePreference(calculatorPreference);
    const {symbol: currencySymbol, code: currencyCode} = useCurrency();
    const suffix = isCurrencySymbolSuffix(currencyCode);
    // The currency's own precision: a yen has no decimals, a dinar has three.
    // Extra digits are dropped as they are typed so what is shown is storable.
    const decimals = getCurrencyDecimals(currencyCode);

    const calc = useAmountCalculator({value, onChangeText, decimals, enabled: calculator});
    const {settle} = calc;
    const handleBlur = useCallback(() => {
      settle();
      onBlur?.();
    }, [settle, onBlur]);

    const accessoryId = `amount-${useId()}`;
    const [focused, setFocused] = useState(false);

    const symbol = (
      <PrimaryText size={15} variant="number" color={colors.secondaryText} maxFontSizeMultiplier={AMOUNT_FONT_CAP}>
        {currencySymbol}
      </PrimaryText>
    );

    const {result} = calc;
    const resultLine =
      result?.kind === 'value'
        ? t('calculator.result', {amount: formatAmount(result.value)})
        : result?.kind === 'error'
          ? t(CALCULATOR_ERROR[result.reason])
          : '';

    // iOS number pads have no return key: Done closes the keyboard (settling a sum first).
    const done = useCallback(() => {
      settle();
      Keyboard.dismiss();
    }, [settle]);
    const keys = (
      <AmountOperatorKeys
        colors={colors}
        onPress={calc.press}
        label={key => t(OPERATOR_LABEL[key])}
        operators={calculator}
        onDone={Platform.OS === 'ios' ? done : undefined}
        doneLabel={t('common.done')}
      />
    );

    return (
      <View style={style}>
        <View
          style={[
            gs.minH48,
            gs.itemsCenter,
            gs.rounded12,
            gs.row,
            suffix ? gs.pr10 : gs.pl10,
            gs.border1,
            {backgroundColor: colors.secondaryAccent, borderColor: colors.inputBorder},
          ]}>
          {!suffix && symbol}
          <TextInput
            ref={ref}
            style={[gs.px15, gs.minH48, gs.flex1, gs.numMedium, gs.noFontPadding, {color: colors.primaryText}]}
            value={calc.text}
            onChangeText={calc.type}
            // The amount grows with the OS text size as every amount does, then stops: uncapped, the
            // field and its symbol pushed the Add form apart at the top three iPhone sizes (audit §9).
            maxFontSizeMultiplier={AMOUNT_FONT_CAP}
            // In the user's digits ("0", "٠", "০"); a literal "0" is Latin everywhere (audit 2026-11-08 §9).
            placeholder={formatNumber(0, {maximumFractionDigits: 0})}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              handleBlur();
            }}
            placeholderTextColor={colors.secondaryText}
            keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={resultLine || undefined}
            autoFocus={autoFocus}
            inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
            // Landscape Android: no full-screen keyboard while the calculator keys are needed;
            // FormScroll keeps the field and its keys above the keyboard instead.
            disableFullscreenUI={calculator}
          />
          {suffix && symbol}
        </View>
        {resultLine ? (
          <PrimaryText
            size={12}
            variant="number"
            color={result?.kind === 'error' ? colors.accentRed : colors.secondaryText}
            style={gs.mt5}
            accessibilityLiveRegion="polite">
            {resultLine}
          </PrimaryText>
        ) : null}
        {/* iOS: Done (and the operator keys) on the keyboard. Android: the operator keys under the field. */}
        {Platform.OS === 'ios' ? (
          // The keys live on the keyboard, but RN 0.88 (Fabric) also leaves the accessory's own
          // view in the layout, un-hidden by its first layout pass, screen-wide and painted with
          // `backgroundColor`: on a device it covered the field and swallowed its taps. A
          // zero-height clipping host keeps that view out of sight and out of hit-testing.
          <View style={styles.accessoryHost}>
            <InputAccessoryView nativeID={accessoryId} backgroundColor={colors.primaryBackground}>
              {keys}
            </InputAccessoryView>
          </View>
        ) : null}
        {calculator && Platform.OS !== 'ios' && focused ? <View style={gs.mt5}>{keys}</View> : null}
      </View>
    );
  },
);

AmountInputComponent.displayName = 'AmountInput';

const styles = StyleSheet.create({
  accessoryHost: {height: 0, overflow: 'hidden'},
});

export const AmountInput = React.memo(AmountInputComponent);
