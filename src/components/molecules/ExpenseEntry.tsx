import {ScrollView, TextInput, View} from 'react-native';
import React, {useCallback, useRef, useState, memo} from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../atoms/PrimaryView';
import AppHeader from '../atoms/AppHeader';
import CustomInput from '../atoms/CustomInput';
import PrimaryText from '../atoms/PrimaryText';
import Icon from '../atoms/Icons';
import CategoryContainer from './CategoryContainer';
import PrimaryButton from '../atoms/PrimaryButton';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {goBack, navigate} from '../../utils/navigationUtils';
import DatePicker from '../atoms/DatePicker';
import {expenseDescriptionSchema, expenseSchema} from '../../i18n/validationSchema';
import {logRejection} from '../../utils/errorLog';
import {gs} from '../../styles/globalStyles';
import AmountInput from '../atoms/AmountInput';
import {useExpenseForm, type EditedExpense} from '../../hooks/useExpenseForm';
import {useDailyAllowanceHint} from '../../hooks/useDailyAllowanceHint';

interface ExpenseEntryProps {
  /** The transaction being edited; absent when adding one. */
  editing?: EditedExpense;
}

const ExpenseEntry: React.FC<ExpenseEntryProps> = ({editing}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Keyboard flow: title → description → amount, then the keyboard closes.
  const descriptionRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const amountRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const {
    categories,
    selectedCategories,
    toggleCategorySelection,
    createdAt,
    setCreatedAt,
    expenseTitle,
    setExpenseTitle,
    expenseDescription,
    setExpenseDescription,
    expenseAmount,
    setExpenseAmount,
    expenseAmountError,
    handleAmountBlur,
    isValid,
    save,
  } = useExpenseForm(editing);
  const dailyBudgetInfo = useDailyAllowanceHint({
    createdAt,
    amount: expenseAmount,
    original: editing ? {amount: editing.amount, date: editing.date} : undefined,
  });

  const handleAddCategory = useCallback(() => {
    navigate('AddCategoryScreen');
  }, []);

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader
          onPress={() => goBack()}
          colors={colors}
          text={editing ? t('transaction.editTitle') : t('transaction.addTitle')}
        />
      </View>

      <CustomInput
        colors={colors}
        input={expenseTitle}
        setInput={setExpenseTitle}
        placeholder={t('transaction.titlePlaceholder')}
        label={t('transaction.titleLabel')}
        schema={expenseSchema}
        returnKeyType="next"
        onSubmitEditing={() => descriptionRef.current?.focus()}
      />
      <CustomInput
        ref={descriptionRef}
        colors={colors}
        input={expenseDescription}
        setInput={setExpenseDescription}
        placeholder={t('transaction.descriptionPlaceholder')}
        label={t('transaction.descriptionLabel')}
        schema={expenseDescriptionSchema}
        returnKeyType="next"
        onSubmitEditing={() => amountRef.current?.focus()}
      />

      <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
        {t('transaction.amountLabel')}
      </PrimaryText>
      <AmountInput
        ref={amountRef}
        value={expenseAmount}
        onChangeText={setExpenseAmount}
        onBlur={handleAmountBlur}
        returnKeyType="done"
        accessibilityLabel={t('transaction.amountLabel')}
        style={expenseAmountError.length > 0 ? gs.mb5 : gs.mb15}
      />
      {expenseAmountError.length > 0 && (
        <View style={gs.mb10}>
          {expenseAmountError.map((error: {message: string}) => (
            <View key={error.message}>
              <PrimaryText size={12} color={colors.accentRed}>
                {error.message}
              </PrimaryText>
            </View>
          ))}
        </View>
      )}

      {dailyBudgetInfo ? (
        <View style={[gs.rowCenter, gs.gap6, gs.mb10]}>
          <Icon name="target" size={13} color={dailyBudgetInfo.exceeded ? colors.accentOrange : colors.accentGreen} />
          <PrimaryText size={11} variant="number" color={colors.secondaryText}>
            {t('transaction.dailyBudget', {amount: formatAmount(Math.round(dailyBudgetInfo.dailyBudget))})}
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText}>
            ·
          </PrimaryText>
          <PrimaryText
            size={11}
            variant="number"
            color={dailyBudgetInfo.exceeded ? colors.accentOrange : colors.accentGreen}>
            {dailyBudgetInfo.exceeded
              ? t('transaction.dailyExceeded', {
                  amount: formatAmount(Math.round(Math.abs(dailyBudgetInfo.dailyRemaining))),
                })
              : t('transaction.dailyRemaining', {amount: formatAmount(Math.round(dailyBudgetInfo.dailyRemaining))})}
          </PrimaryText>
        </View>
      ) : null}

      {/* No future dates: the month picker cannot browse future months, so a
          future-dated expense would be saved and then unreachable (B4). */}
      <DatePicker
        setShowDatePicker={setShowDatePicker}
        createdAt={createdAt}
        showDatePicker={showDatePicker}
        setCreatedAt={setCreatedAt}
        label={t('transaction.dateLabel')}
        maxDate={new Date()}
      />

      <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
        {t('transaction.categoryLabel')}
      </PrimaryText>
      {/* keyboardShouldPersistTaps + keyboardDismissMode replace the
          screen-wide TouchableWithoutFeedback: they dismiss the keyboard
          without taking the touch responder away from this ScrollView. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <CategoryContainer
          categories={categories}
          colors={colors}
          toggleCategorySelection={toggleCategorySelection}
          selectedCategories={selectedCategories}
        />
        <PrimaryButton
          onPress={handleAddCategory}
          colors={colors}
          buttonTitle={t('transaction.addCategoryButton')}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      </ScrollView>
      <View style={gs.mt5}>
        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={editing ? t('common.update') : t('common.add')}
          disabled={!isValid || selectedCategories.length === 0}
        />
      </View>
    </PrimaryView>
  );
};

export default memo(ExpenseEntry);
