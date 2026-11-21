import React, {useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {AmountInput} from '../../../../ui/atoms/AmountInput';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useDialog} from '../../../../ui/context/DialogContext';
import {useAppSelector} from '../../../../store/hooks';
import {selectCurrencyCode} from '../../../../store/slices/currencyDataSlice';
import {createAmountSchema} from '../../../../i18n/validationSchema';
import {confirmOccurrence, getRuleById, type RuleData} from '../../../../data/services/recurringService';
import {occurrence} from '../../../../domain/recurrence';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {goBack} from '../../../../platform/navigationUtils';
import {appendErrorLog, logRejection} from '../../../../platform/errorLog';
import {rerunProducers} from '../../../../pro/producers';
import type {HomeStackParamList} from '../../../../navigation/types';
import {gs} from '../../../../ui/globalStyles';

const Confirm = ({rule, index}: {rule: RuleData; index: number}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {showAlert} = useDialog();
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const schema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const valid = schema.issues(Number(amount)).length === 0;
  const date = formatDisplayDate(occurrence(rule, index), 'dayMonth');

  const save = useCallback(async () => {
    if (!valid || saving) {
      return;
    }
    setSaving(true);
    try {
      await confirmOccurrence(rule.id, index, Number(amount));
      await rerunProducers();
    } catch (error) {
      appendErrorLog(error, false);
      setSaving(false);
      await showAlert({type: 'error', message: t('recurring.saveFailed')});
      return;
    }
    goBack();
  }, [valid, saving, rule.id, index, amount, showAlert, t]);

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={t('recurring.confirmTitle')} subtitle={rule.title} />
        </View>
        <PrimaryText size={14} style={gs.mb10}>
          {t('recurring.confirmLead', {title: rule.title, date})}
        </PrimaryText>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          returnKeyType="done"
          accessibilityLabel={t('recurring.amountLabel')}
          autoFocus
          style={gs.mb15}
        />
        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={t('common.add')}
          disabled={!valid || saving}
        />
      </FormScroll>
    </PrimaryView>
  );
};

/** The amount for an occurrence of a rule that varies: entered, the entry is made on its day. */
export const ConfirmRecurringScreen = () => {
  const {ruleId, index} = useRoute<RouteProp<HomeStackParamList, 'ConfirmRecurringScreen'>>().params;
  const state = useRecord(ruleId, getRuleById);
  return <RecordGate state={state}>{rule => <Confirm rule={rule} index={index} />}</RecordGate>;
};
