import React, {useState, memo, useRef} from 'react';
import {View, TouchableOpacity, TextInput} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '../../components/atoms/AppHeader';
import CustomInput from '../../components/atoms/CustomInput';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import PrimaryView from '../../components/atoms/PrimaryView';
import {goBack} from '../../utils/navigationUtils';
import useThemeColors from '../../hooks/useThemeColors';
import DatePicker from '../atoms/DatePicker';
import {expenseSchema} from '../../i18n/validationSchema';
import {BORROW, LEND} from '../../utils/debtType';
import {logRejection} from '../../utils/errorLog';
import PrimaryText from '../atoms/PrimaryText';
import {gs} from '../../styles/globalStyles';
import AmountInput from '../atoms/AmountInput';
import {useDebtForm, type EditedDebt} from '../../hooks/useDebtForm';

interface DebtEntryProps {
  debtor: {debtorId: string; debtorName: string};
  /** The debt being edited; absent when adding one. */
  editing?: EditedDebt;
}

const DebtEntry: React.FC<DebtEntryProps> = ({debtor, editing}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {debtorName} = debtor;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const amountRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const {
    debtName,
    setDebtName,
    debtAmount,
    setDebtAmount,
    createdAt,
    setCreatedAt,
    debtsType,
    setDebtsType,
    debtAmountError,
    isValid,
    handleAmountBlur,
    save,
  } = useDebtForm(debtor.debtorId, editing);

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween} dismissKeyboardOnTouch>
      <View>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={editing ? t('debt.editTitle') : t('debt.addTitle')} />
        </View>

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {debtorName}
        </PrimaryText>
        <View style={[gs.row, gs.gap8, gs.mb15]}>
          {([BORROW, LEND] as const).map(debtTypeOption => {
            const isSelected = debtsType === debtTypeOption;
            const label = debtTypeOption === BORROW ? t('debts.borrowing') : t('debts.lending');
            let bgColor = colors.secondaryAccent;
            if (isSelected && debtTypeOption === BORROW) {
              bgColor = colors.accentOrange;
            } else if (isSelected) {
              bgColor = colors.accentGreen;
            }
            return (
              <TouchableOpacity
                key={debtTypeOption}
                onPress={() => setDebtsType(debtTypeOption)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={label}
                style={[gs.py8, gs.minTouch, gs.px14, gs.rounded12, gs.center, {backgroundColor: bgColor}]}>
                <PrimaryText
                  size={13}
                  weight={isSelected ? 'semibold' : 'regular'}
                  color={isSelected ? colors.buttonText : colors.primaryText}>
                  {label}
                </PrimaryText>
              </TouchableOpacity>
            );
          })}
        </View>

        <CustomInput
          colors={colors}
          input={debtName}
          setInput={setDebtName}
          placeholder={t('debt.descriptionPlaceholder')}
          label={t('transaction.descriptionLabel')}
          schema={expenseSchema}
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
        />

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          {t('transaction.amountLabel')}
        </PrimaryText>
        <AmountInput
          ref={amountRef}
          value={debtAmount}
          onChangeText={setDebtAmount}
          onBlur={handleAmountBlur}
          returnKeyType="done"
          accessibilityLabel={t('transaction.amountLabel')}
          style={debtAmountError.length > 0 ? gs.mb5 : gs.mb15}
        />
        {debtAmountError.length > 0 && (
          <View style={gs.mb10}>
            {debtAmountError.map((error: {message: string}) => (
              <View key={error.message}>
                <PrimaryText size={12} color={colors.accentRed}>
                  {error.message}
                </PrimaryText>
              </View>
            ))}
          </View>
        )}

        <DatePicker
          setShowDatePicker={setShowDatePicker}
          createdAt={createdAt}
          showDatePicker={showDatePicker}
          setCreatedAt={setCreatedAt}
          label={t('transaction.dateLabel')}
        />
      </View>

      <View style={gs.mb10p}>
        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={editing ? t('common.update') : t('common.add')}
          disabled={!isValid}
        />
      </View>
    </PrimaryView>
  );
};

export default memo(DebtEntry);
