import {ScrollView, TextInput, View} from 'react-native';
import React, {useRef, useState, memo} from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../ui/atoms/AppHeader';
import {CustomInput} from '../../../ui/atoms/CustomInput';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import {CategoryContainer} from '../../../ui/molecules/CategoryContainer';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {goBack} from '../../../platform/navigationUtils';
import {DatePicker} from '../../../ui/atoms/DatePicker';
import {expenseDescriptionSchema, expenseSchema} from '../../../i18n/validationSchema';
import {logRejection} from '../../../platform/errorLog';
import {gs} from '../../../ui/globalStyles';
import {AmountInput} from '../../../ui/atoms/AmountInput';
import {useExpenseForm, type EditedExpense} from '../hooks/useExpenseForm';
import {useDailyAllowanceHint} from '../hooks/useDailyAllowanceHint';
import {ExpenseRefunds} from './ExpenseRefunds';
import type {QuickAddDraft} from '../../../ui/quickAddDraft';

interface ExpenseEntryProps {
  /** The transaction being edited; absent when adding one. */
  editing?: EditedExpense;
  /** Values carried over from the quick-add sheet ("More details"). */
  draft?: QuickAddDraft;
}

const ExpenseEntryComponent: React.FC<ExpenseEntryProps> = ({editing, draft}) => {
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
    addCategory,
    fromHistory,
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
  } = useExpenseForm(editing, draft);
  const dailyBudgetInfo = useDailyAllowanceHint({
    createdAt,
    amount: expenseAmount,
    original: editing ? {amount: editing.amount, date: editing.date} : undefined,
  });

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
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
            <Amount weight="medium" size={11} color={colors.secondaryText}>
              {t('transaction.dailyBudget', {amount: formatAmount(Math.round(dailyBudgetInfo.dailyBudget))})}
            </Amount>
            <PrimaryText size={11} color={colors.secondaryText}>
              ·
            </PrimaryText>
            <Amount
              weight="medium"
              size={11}
              color={dailyBudgetInfo.exceeded ? colors.accentOrange : colors.accentGreen}>
              {dailyBudgetInfo.exceeded
                ? t('transaction.dailyExceeded', {
                    amount: formatAmount(Math.round(Math.abs(dailyBudgetInfo.dailyRemaining))),
                  })
                : t('transaction.dailyRemaining', {amount: formatAmount(Math.round(dailyBudgetInfo.dailyRemaining))})}
            </Amount>
          </View>
        ) : null}

        {/* Editing only: money that came back on this expense (2.8 refunds). */}
        {editing ? <ExpenseRefunds expenseId={editing.id} expenseAmount={editing.amount} /> : null}

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

        <View style={[gs.rowCenter, gs.gap6, gs.mb8]}>
          <PrimaryText size={12} color={colors.secondaryText}>
            {t('transaction.categoryLabel')}
          </PrimaryText>
          {fromHistory ? (
            <PrimaryText size={11} color={colors.accentGreen} accessibilityLiveRegion="polite">
              · {t('transaction.fromHistory')}
            </PrimaryText>
          ) : null}
        </View>
        {/* Nested on purpose (audit 2026-11-08, Appendix A, reviewed): in
          portrait with no keyboard FormScroll does not scroll and the form is
          one screen tall, so this list shrinks into the space left (a
          ScrollView's default flexShrink) and scrolls the categories while
          Add stays on screen. When FormScroll does scroll (landscape, keyboard
          up), Android only lets this inner list scroll with
          nestedScrollEnabled. keyboardShouldPersistTaps + keyboardDismissMode
          keep a chip tap from being eaten by the keyboard. */}
        <ScrollView
          nestedScrollEnabled
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
            onPress={addCategory}
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
      </FormScroll>
    </PrimaryView>
  );
};

export const ExpenseEntry = memo(ExpenseEntryComponent);
