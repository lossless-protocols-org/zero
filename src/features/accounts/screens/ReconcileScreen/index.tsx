import React, {useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Amount} from '../../../../ui/atoms/Amount';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {displayAccountName} from '../../../../i18n/displayNames';
import {expenseDescriptionSchema} from '../../../../i18n/validationSchema';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import type {HomeStackParamList} from '../../../../navigation/types';
import type {CheckpointPreview} from '../../../../data/services/checkpointService';
import {useReconcile} from '../../hooks/useReconcile';
import {CHECK_LABEL} from '../../accountCopy';
import {classOf} from '../../../../domain/accounts';
import {gs} from '../../../../ui/globalStyles';
import type {TFunction} from 'i18next';

/** The gap in words, and why it is there: an investment's is its value change (R15); any other is what the entries miss. */
const gapWords = (
  preview: CheckpointPreview,
  investment: boolean,
  format: (n: number) => string,
  t: TFunction,
): {line: string; why: string} => {
  const amount = format(Math.abs(preview.gap));
  if (preview.gap === 0) {
    return {line: t('accounts.gapNone'), why: ''};
  }
  if (investment) {
    return {
      line: preview.gap > 0 ? t('accounts.valueUp', {amount}) : t('accounts.valueDown', {amount}),
      why: t('accounts.valueWhy'),
    };
  }
  return preview.gap > 0
    ? {line: t('accounts.gapMore', {amount}), why: t('accounts.gapMoreWhy')}
    : {line: t('accounts.gapLess', {amount}), why: t('accounts.gapLessWhy')};
};

/**
 * Setting an account's balance by hand (UX revamp v2). One engine, three
 * acts, each named for what the user is doing: checking a balance against the
 * bank, checking what a card says is owed, or noting what an investment is
 * worth today. The screen puts two figures face to face, what zero says and
 * what the user types, says what the difference means, and saves.
 */
export const ReconcileScreen = () => {
  const {accountId} = useRoute<RouteProp<HomeStackParamList, 'ReconcileScreen'>>().params;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const form = useReconcile(accountId);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const name = form.account ? displayAccountName(form.account.name, t) : '';
  const group = form.account ? classOf(form.account.type) : 'spend';
  const investment = group === 'save';
  const signed = (n: number) => (n < 0 ? `−${formatAmount(-n)}` : formatAmount(n));
  const words = form.preview ? gapWords(form.preview, investment, formatAmount, t) : null;
  // What zero's entries give, said the way the account is read: a card as what is owed.
  const derived = form.preview
    ? form.owes && form.preview.derived < 0
      ? t('accounts.youOweAmount', {amount: formatAmount(-form.preview.derived)})
      : signed(form.preview.derived)
    : '';
  const fieldLabel = form.owes
    ? t('accounts.checkOwes')
    : investment
      ? t('accounts.checkWorth')
      : t('accounts.checkHolds');

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={t(CHECK_LABEL[group])} subtitle={name} />
        </View>

        <DatePicker
          setShowDatePicker={setShowDatePicker}
          createdAt={form.pickerDate}
          showDatePicker={showDatePicker}
          setCreatedAt={form.setPickerDate}
          label={t('transaction.dateLabel')}
          maxDate={new Date()}
        />

        <CustomInput
          colors={colors}
          input={form.balance}
          setInput={form.setBalance}
          placeholder="0"
          label={fieldLabel}
          keyboardType={form.owes ? 'decimal-pad' : 'numbers-and-punctuation'}
          autoFocus
        />

        {form.preview && words ? (
          <View
            accessibilityLiveRegion="polite"
            style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
              {t('accounts.zeroSays')}
            </PrimaryText>
            <Amount size={16}>{derived}</Amount>
            <PrimaryText
              size={14}
              weight="semibold"
              color={form.preview.gap === 0 ? colors.accentGreen : colors.primaryText}
              style={gs.mt8}>
              {words.line}
            </PrimaryText>
            {words.why ? (
              <PrimaryText size={12} color={colors.secondaryText} style={gs.mt3}>
                {words.why}
              </PrimaryText>
            ) : null}
          </View>
        ) : null}
        {form.canRecordMissing && form.preview ? (
          <View style={gs.mb15}>
            <PrimaryButton
              onPress={form.recordMissing}
              colors={colors}
              buttonTitle={
                form.gapIsInterest
                  ? t('accounts.recordInterest')
                  : form.preview.gap < 0
                    ? t('accounts.recordMissingExpense')
                    : t('accounts.recordMissingIncome')
              }
              variant="outline"
            />
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mt6}>
              {form.gapIsInterest ? t('accounts.interestWhy') : t('accounts.saveAdjusts')}
            </PrimaryText>
          </View>
        ) : null}

        <CustomInput
          colors={colors}
          input={form.note}
          setInput={form.setNote}
          placeholder={t('accounts.reconcileNotePlaceholder')}
          label={t('accounts.noteOptional')}
          schema={expenseDescriptionSchema}
          returnKeyType="done"
        />

        <View style={gs.mt5}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={investment ? t('accounts.acceptValue') : t('accounts.accept')}
            disabled={!form.isValid || form.saving}
          />
        </View>
      </FormScroll>
    </PrimaryView>
  );
};
