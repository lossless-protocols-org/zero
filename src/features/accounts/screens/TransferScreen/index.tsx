import React, {useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {AmountInput} from '../../../../ui/atoms/AmountInput';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {Icon} from '../../../../ui/atoms/Icons';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useNetWorth} from '../../../../ui/hooks/useNetWorth';
import {displayAccountName} from '../../../../i18n/displayNames';
import {expenseDescriptionSchema} from '../../../../i18n/validationSchema';
import {lessOf} from '../../../../domain/commitments';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import type {HomeStackParamList} from '../../../../navigation/types';
import {useTransferForm} from '../../hooks/useTransferForm';
import {formatBalance} from '../../../../ui/accountWords';
import {gs, hitSlop} from '../../../../ui/globalStyles';

/**
 * Money moved between two of the user's accounts (UX revamp v2). The amount
 * comes first; both accounts sit in one card with a swap between them, each
 * showing what it holds now and what it will hold after, so nobody picks an
 * account blind. The button says what it does, with the amount.
 */
export const TransferScreen = () => {
  const params = useRoute<RouteProp<HomeStackParamList, 'TransferScreen'>>().params;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const form = useTransferForm(params?.transferId, {
    fromAccountId: params?.fromAccountId,
    toAccountId: params?.toAccountId,
    amount: params?.amount,
  });
  const {worth} = useNetWorth(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Each side's balance now and, once the amount is a number, after the move. Unknown while balances load.
  const balanceLine = (accountId: string | undefined, sign: 1 | -1): string | undefined => {
    const balance = worth?.accounts.find(account => account.accountId === accountId)?.balance;
    if (balance === undefined) {
      return undefined;
    }
    const now = formatBalance(formatAmount, balance);
    // An edit's amount is already in the balance, so "after" would count it twice.
    if (form.value === null || form.isEditing) {
      return now;
    }
    return t('accounts.balanceAfter', {now, after: formatBalance(formatAmount, lessOf(balance, -sign * form.value))});
  };
  const fromName = form.from ? displayAccountName(form.from.name, t) : '';
  const toName = form.to ? displayAccountName(form.to.name, t) : '';
  const fromLine = balanceLine(form.from?.id, -1);
  const toLine = balanceLine(form.to?.id, 1);

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={goBack}
            colors={colors}
            text={form.isEditing ? t('accounts.editTransferTitle') : t('accounts.transferTitle')}
          />
        </View>

        {form.missing ? (
          <PrimaryText size={14} color={colors.secondaryText} style={gs.mb15}>
            {t('common.recordMissing')}
          </PrimaryText>
        ) : null}

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          {t('transaction.amountLabel')}
        </PrimaryText>
        <AmountInput
          value={form.amount}
          onChangeText={form.setAmount}
          onBlur={form.onAmountBlur}
          returnKeyType="done"
          accessibilityLabel={t('transaction.amountLabel')}
          style={form.amountErrors.length > 0 ? gs.mb5 : gs.mb15}
        />
        {form.amountErrors.map(message => (
          <PrimaryText key={message} size={12} color={colors.accentRed} style={gs.mb10}>
            {message}
          </PrimaryText>
        ))}

        <View style={gs.mb10}>
          <ListSection>
            <ListRow
              dynamicIcon={form.from?.icon ?? ''}
              iconColor={form.from?.color || colors.primaryText}
              title={fromName}
              subtitle={[t('accounts.fromLabel'), fromLine].filter(Boolean).join(' · ')}
              onPress={form.pickFrom}
              chevron={false}
              accessibilityLabel={t('accounts.fromAccountA11y', {name: fromName, balance: fromLine ?? ''})}
            />
            <ListRow
              dynamicIcon={form.to?.icon ?? ''}
              iconColor={form.to?.color || colors.primaryText}
              title={toName}
              subtitle={[t('accounts.toLabel'), toLine].filter(Boolean).join(' · ')}
              onPress={form.pickTo}
              chevron={false}
              accessibilityLabel={t('accounts.toAccountA11y', {name: toName, balance: toLine ?? ''})}
            />
          </ListSection>
          <View style={[gs.absolute, gs.end15, gs.hFull, gs.justifyCenter]} pointerEvents="box-none">
            <TouchableOpacity
              onPress={form.swap}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('accounts.swap')}
              style={[gs.size36, gs.center, gs.roundedFull, {backgroundColor: colors.primaryBackground}]}>
              <Icon name="arrow-up-down" size={18} color={colors.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
        {form.sameAccount ? (
          <PrimaryText size={12} color={colors.accentRed} style={gs.mb10}>
            {t('accounts.sameAccount')}
          </PrimaryText>
        ) : null}

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
          input={form.note}
          setInput={form.setNote}
          placeholder={t('accounts.notePlaceholder')}
          label={t('accounts.noteOptional')}
          schema={expenseDescriptionSchema}
          returnKeyType="done"
        />

        <PrimaryText size={11} color={colors.secondaryText} style={gs.mb10}>
          {t('accounts.movedNotSpent')}
        </PrimaryText>

        <View style={[gs.mt5, gs.gap10]}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={
              form.isEditing
                ? t('common.update')
                : form.value === null
                  ? t('accounts.transfer')
                  : t('accounts.moveAmount', {amount: formatAmount(form.value)})
            }
            disabled={!form.isValid || form.saving}
          />
          {form.isEditing ? (
            <PrimaryButton
              onPress={() => logRejection(form.remove())}
              colors={colors}
              buttonTitle={t('common.delete')}
              variant="ghost"
            />
          ) : null}
        </View>
      </FormScroll>
    </PrimaryView>
  );
};
