import React, {memo, useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../ui/atoms/FormScroll';
import {AppHeader} from '../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {CustomInput} from '../../../ui/atoms/CustomInput';
import {AmountInput} from '../../../ui/atoms/AmountInput';
import {DatePicker} from '../../../ui/atoms/DatePicker';
import {CategoryContainer} from '../../../ui/molecules/CategoryContainer';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useIncomeForm} from '../hooks/useIncomeForm';
import {expenseDescriptionSchema} from '../../../i18n/validationSchema';
import {goBack} from '../../../platform/navigationUtils';
import {logRejection} from '../../../platform/errorLog';
import {gs} from '../../../ui/globalStyles';
import type {IncomeData} from '../../../domain/types';

interface IncomeEntryProps {
  /** The income being edited; absent when adding one. */
  editing?: IncomeData;
  /** The month the Money tab showed, for a new entry's date. */
  yearMonth?: string;
}

/**
 * Money in: amount, day, note. Deliberately unlike the expense form (R11):
 * no title, no category grid while there is one income category, no
 * daily-allowance hint, no time of day.
 */
const IncomeEntryComponent: React.FC<IncomeEntryProps> = ({editing, yearMonth}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const form = useIncomeForm(editing, yearMonth);
  const selected = form.categories.filter(c => c.id === form.categoryId);

  return (
    <PrimaryView colors={colors}>
      <FormScroll>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={() => goBack()}
            colors={colors}
            text={editing ? t('money.editTitle') : t('money.addTitle')}
          />
        </View>

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

        {/* No future days: the month picker cannot browse future months (B4). */}
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
          placeholder={t('money.notePlaceholder')}
          label={t('money.noteLabel')}
          schema={expenseDescriptionSchema}
          returnKeyType="done"
        />

        {/* Free has one income category; the choice appears only once there are more (3.0). */}
        {form.categories.length > 1 ? (
          <>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
              {t('money.categoryLabel')}
            </PrimaryText>
            <CategoryContainer
              categories={form.categories}
              colors={colors}
              selectedCategories={selected}
              toggleCategorySelection={category => {
                const match = form.categories.find(c => c.name === category.name);
                if (match) {
                  form.setCategoryId(match.id);
                }
              }}
            />
          </>
        ) : null}

        <View style={[gs.mt5, gs.gap10]}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={editing ? t('common.update') : t('common.add')}
            disabled={!form.isValid || form.saving}
          />
          {editing ? (
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

export const IncomeEntry = memo(IncomeEntryComponent);
