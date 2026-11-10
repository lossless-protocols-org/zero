import {ScrollView, View} from 'react-native';
import React, {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../ui/atoms/FormScroll';
import {goBack} from '../../../platform/navigationUtils';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {AppHeader} from '../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {CategoryContainer} from '../../../ui/molecules/CategoryContainer';
import {CustomInput} from '../../../ui/atoms/CustomInput';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {logRejection} from '../../../platform/errorLog';
import {nameSchema} from '../../../i18n/validationSchema';
import {gs} from '../../../ui/globalStyles';
import {useDebtorForm, type EditedDebtor} from '../hooks/useDebtorForm';

interface DebtorEntryProps {
  /** The debtor being edited; absent when adding one. */
  editing?: EditedDebtor;
}

const DebtorEntryComponent: React.FC<DebtorEntryProps> = ({editing}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {
    debtCategories,
    debtorTitle,
    setDebtorTitle,
    selectedCategories,
    toggleCategorySelection,
    isDuplicate,
    isValid,
    save,
  } = useDebtorForm(editing);

  return (
    <PrimaryView colors={colors}>
      <FormScroll contentStyle={gs.justifyBetween}>
        <View>
          <View style={[gs.mb20, gs.mt20]}>
            <AppHeader onPress={goBack} colors={colors} text={editing ? t('debtor.editTitle') : t('debtor.addTitle')} />
          </View>

          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
            {t('debtor.typeLabel')}
          </PrimaryText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={gs.mb15}>
            <CategoryContainer
              categories={debtCategories}
              nameKind="debtAccount"
              colors={colors}
              toggleCategorySelection={toggleCategorySelection}
              selectedCategories={selectedCategories}
            />
          </ScrollView>

          <CustomInput
            colors={colors}
            input={debtorTitle}
            setInput={setDebtorTitle}
            placeholder={t('debtor.namePlaceholder')}
            label={t('debtor.nameLabel')}
            schema={nameSchema}
            externalError={isDuplicate ? t('validation.duplicateDebtor') : undefined}
          />
        </View>
        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={editing ? t('common.update') : t('common.add')}
          disabled={!isValid}
        />
      </FormScroll>
    </PrimaryView>
  );
};

export const DebtorEntry = memo(DebtorEntryComponent);
