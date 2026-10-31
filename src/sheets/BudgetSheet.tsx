import {Switch, TextInput, TouchableOpacity, View, StyleSheet} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../i18n/displayNames';
import {SheetManager, SheetProps, ScrollView} from 'react-native-actions-sheet';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryButton from '../components/atoms/PrimaryButton';
import PrimaryText from '../components/atoms/PrimaryText';
import Icon from '../components/atoms/Icons';
import {isCurrencySymbolSuffix} from '../utils/numberUtils';
import {normalizeAmountInput} from '../utils/amountInput';
import {createAmountSchema, getAmountLimits} from '../i18n/validationSchema';
import {gs} from '../styles/globalStyles';

import type {BudgetScopeList, BudgetScopeOption} from '../utils/budgetScopes';

const BudgetSheet: React.FC<SheetProps<'budget-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const scopes: BudgetScopeList = props.payload?.scopes ?? [
    {categoryId: '', name: t('sheets.scopeOverall'), isRecurring: false},
  ];
  const [scopeId, setScopeId] = useState(props.payload?.initialCategoryId ?? '');
  const scope = scopes.find(s => s.categoryId === scopeId) ?? scopes[0];

  const [amount, setAmount] = useState(scope.currentAmount ? String(scope.currentAmount) : '');
  const [everyMonth, setEveryMonth] = useState(scope.isRecurring);

  const currencyCode = props.payload?.currencyCode;
  const {decimals} = getAmountLimits(currencyCode);
  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const parsedAmount = Number.parseFloat(amount);
  const amountResult = amountSchema.safeParse(parsedAmount);
  const isValid = amount.length > 0 && amountResult.success;
  const amountError = amount.length > 0 && !amountResult.success ? amountResult.error.issues[0]?.message : undefined;

  const handleScopeChange = useCallback((next: BudgetScopeOption) => {
    setScopeId(next.categoryId);
    setAmount(next.currentAmount ? String(next.currentAmount) : '');
    setEveryMonth(next.isRecurring);
  }, []);

  const handleSave = useCallback(() => {
    if (isValid) {
      props.payload?.onSave?.(parsedAmount, everyMonth, scope.categoryId || undefined);
    }
    void SheetManager.hide(props.sheetId);
  }, [props, isValid, parsedAmount, everyMonth, scope.categoryId]);

  const handleRemove = useCallback(() => {
    props.payload?.onRemove?.(scope.isRecurring, scope.categoryId || undefined);
    void SheetManager.hide(props.sheetId);
  }, [props, scope]);

  // Shared with AmountInput. The old inline version stripped every character
  // outside [0-9.], which turned a European "12,50" into 1250 — a silent 100x
  // budget with nothing on screen to indicate it.
  const handleAmountChange = useCallback(
    (text: string) => {
      setAmount(normalizeAmountInput(text, decimals));
    },
    [decimals],
  );

  // Symbol sits on the side the user's locale puts it. Without a currency
  // code in the payload the check returns false — the old prefix behaviour.
  const symbolIsSuffix = isCurrencySymbolSuffix(currencyCode);
  const budgetSymbol = (
    <PrimaryText size={16} color={colors.secondaryText} style={symbolIsSuffix ? gs.ml8 : gs.mr8}>
      {props.payload?.currencySymbol ?? '$'}
    </PrimaryText>
  );

  const isOverall = scope.categoryId === '';

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: isOverall
          ? t('sheets.setBudget')
          : t('sheets.setCategoryBudget', {name: displayCategoryName(scope.name, t)}),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {scopes.length > 1 ? (
          <>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
              {t('sheets.budgetScopeLabel')}
            </PrimaryText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={gs.mb12}>
              <View style={[gs.row, gs.gap8]}>
                {scopes.map(option => {
                  const selected = option.categoryId === scope.categoryId;
                  return (
                    <TouchableOpacity
                      key={option.categoryId || 'overall'}
                      onPress={() => handleScopeChange(option)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{selected}}
                      accessibilityLabel={displayCategoryName(option.name, t)}>
                      <View
                        style={[
                          gs.py8,
                          gs.minTouch,
                          gs.px14,
                          gs.rounded12,
                          gs.rowCenter,
                          gs.gap6,
                          {backgroundColor: selected ? colors.primaryText : colors.secondaryAccent},
                        ]}>
                        {option.icon ? (
                          <Icon
                            name={option.icon}
                            size={14}
                            color={selected ? colors.buttonText : (option.color ?? colors.secondaryText)}
                          />
                        ) : null}
                        <PrimaryText
                          size={13}
                          weight={selected ? 'semibold' : 'regular'}
                          numberOfLines={1}
                          style={gs.maxW160}
                          color={selected ? colors.buttonText : colors.primaryText}>
                          {displayCategoryName(option.name, t)}
                        </PrimaryText>
                        {option.currentAmount ? (
                          <View
                            style={[
                              gs.size6,
                              gs.roundedFull,
                              {backgroundColor: selected ? colors.buttonText : colors.accentGreen},
                            ]}
                          />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        ) : null}

        {props.payload?.monthLabel ? (
          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
            {everyMonth
              ? t('sheets.budgetForEveryMonth')
              : t('sheets.budgetForMonth', {month: props.payload.monthLabel})}
          </PrimaryText>
        ) : null}
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          {isOverall ? t('sheets.monthlyBudgetLabel') : t('sheets.categoryBudgetLabel')}
        </PrimaryText>

        <View
          style={[
            gs.minH48,
            gs.rounded12,
            gs.px15,
            gs.rowCenter,
            gs.border15,
            {backgroundColor: colors.secondaryAccent, borderColor: amountError ? colors.accentRed : colors.inputBorder},
          ]}>
          {!symbolIsSuffix && budgetSymbol}
          <TextInput
            style={[
              gs.flex1,
              gs.minH48,
              gs.fontMedium,
              gs.noFontPadding,
              styles.amountText,
              {color: colors.primaryText},
            ]}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={colors.secondaryText}
            keyboardType="decimal-pad"
            autoFocus
          />
          {symbolIsSuffix && budgetSymbol}
        </View>
        {amountError ? (
          <PrimaryText size={12} color={colors.accentRed} style={gs.mt5}>
            {amountError}
          </PrimaryText>
        ) : null}

        {/* One accessible node, not two: the row used to be a TouchableOpacity
            wrapping a Switch, which produced a duplicate a11y target and two
            toggle paths. The row is now the switch. */}
        <TouchableOpacity
          onPress={() => setEveryMonth(prev => !prev)}
          activeOpacity={0.7}
          accessibilityRole="switch"
          accessibilityState={{checked: everyMonth}}
          accessibilityLabel={t('sheets.everyMonth')}
          accessibilityHint={t('sheets.everyMonthHint')}
          style={[gs.rowBetweenCenter, gs.mt15, gs.px3]}>
          <View style={gs.flex1}>
            <PrimaryText size={13} weight="medium">
              {t('sheets.everyMonth')}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mt2}>
              {t('sheets.everyMonthHint')}
            </PrimaryText>
          </View>
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Switch value={everyMonth} trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}} />
          </View>
        </TouchableOpacity>

        <View style={gs.mt20}>
          <PrimaryButton
            onPress={handleSave}
            colors={colors}
            buttonTitle={scope.currentAmount ? t('common.update') : t('sheets.setBudgetButton')}
            disabled={!isValid}
          />
        </View>

        {scope.currentAmount ? (
          <TouchableOpacity
            onPress={handleRemove}
            style={[gs.center, gs.mt15]}
            accessibilityRole="button"
            accessibilityLabel={t('sheets.removeBudget')}>
            <View style={gs.rowCenter}>
              <Icon name="trash-2" size={14} color={colors.accentOrange} />
              <PrimaryText size={13} color={colors.accentOrange} style={gs.ml8}>
                {t('sheets.removeBudget')}
              </PrimaryText>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </CustomBottomSheet>
  );
});

export default BudgetSheet;

const styles = StyleSheet.create({
  amountText: {fontSize: 16},
});
