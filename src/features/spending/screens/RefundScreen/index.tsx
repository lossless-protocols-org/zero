import React, {useState} from 'react';
import {View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {toDayKey} from '../../../../domain/dates';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {AmountInput} from '../../../../ui/atoms/AmountInput';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {useRefundForm} from '../../hooks/useRefundForm';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {getExpenseById} from '../../../../data/services/expenseService';
import type {ExpenseWithCategory} from '../../../../domain/types';
import {expenseDescriptionSchema} from '../../../../i18n/validationSchema';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {gs} from '../../../../ui/globalStyles';
import type {HomeStackParamList} from '../../../../navigation/types';

/** "Got money back" on one expense, or an edit of one of its refunds. */
const RefundForm: React.FC<{expense: ExpenseWithCategory; refundId?: string}> = ({expense, refundId}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const form = useRefundForm(expense, refundId);

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={() => goBack()}
            colors={colors}
            text={form.editing ? t('refund.editTitle') : t('refund.addTitle')}
          />
        </View>

        <View style={[gs.px14, gs.py12, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
          <View style={gs.rowBetweenCenter}>
            <PrimaryText weight="medium" numberOfLines={1} style={gs.flex1}>
              {expense.title}
            </PrimaryText>
            <Amount weight="semibold">{formatAmount(expense.amount)}</Amount>
          </View>
          <PrimaryText size={12} color={colors.secondaryText} style={gs.mt4}>
            {form.loaded ? t('refund.upTo', {amount: formatAmount(form.remainder), title: expense.title}) : ' '}
          </PrimaryText>
        </View>

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          {t('refund.amountLabel')}
        </PrimaryText>
        <AmountInput
          value={form.amount}
          onChangeText={form.setAmount}
          onBlur={form.onAmountBlur}
          returnKeyType="done"
          accessibilityLabel={t('refund.amountLabel')}
          style={form.amountErrors.length > 0 ? gs.mb5 : gs.mb15}
        />
        {form.amountErrors.map(message => (
          <PrimaryText key={message} size={12} color={colors.accentRed} style={gs.mb10}>
            {message}
          </PrimaryText>
        ))}

        {/* Money comes back on or after the purchase day, and never in the future. */}
        <DatePicker
          setShowDatePicker={setShowDatePicker}
          createdAt={form.date}
          showDatePicker={showDatePicker}
          setCreatedAt={form.setDate}
          label={t('transaction.dateLabel')}
          // Start of the purchase day: refund bounds compare days, not times.
          minDate={new Date(`${toDayKey(expense.date)}T00:00:00`)}
          maxDate={new Date()}
        />

        <CustomInput
          colors={colors}
          input={form.note}
          setInput={form.setNote}
          placeholder={t('refund.notePlaceholder')}
          label={t('refund.noteLabel')}
          schema={expenseDescriptionSchema}
          returnKeyType="done"
        />

        <View style={[gs.mt5, gs.gap10]}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={form.editing ? t('common.update') : t('refund.record')}
            disabled={!form.isValid || form.saving}
          />
          {form.editing ? (
            <PrimaryButton
              onPress={() => logRejection(form.remove())}
              colors={colors}
              buttonTitle={t('refund.delete')}
              variant="ghost"
            />
          ) : null}
        </View>
      </FormScroll>
    </PrimaryView>
  );
};

export const RefundScreen = () => {
  const {expenseId, refundId} = useRoute<RouteProp<HomeStackParamList, 'RefundScreen'>>().params;
  const state = useRecord(expenseId, getExpenseById);
  return <RecordGate state={state}>{expense => <RefundForm expense={expense} refundId={refundId} />}</RecordGate>;
};
