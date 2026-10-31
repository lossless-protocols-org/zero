import {ScrollView, View} from 'react-native';
import React, {memo} from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../atoms/PrimaryView';
import {goBack} from '../../utils/navigationUtils';
import useThemeColors from '../../hooks/useThemeColors';
import AppHeader from '../atoms/AppHeader';
import PrimaryText from '../atoms/PrimaryText';
import CategoryContainer from './CategoryContainer';
import CustomInput from '../atoms/CustomInput';
import PrimaryButton from '../atoms/PrimaryButton';
import {logRejection} from '../../utils/errorLog';
import {nameSchema} from '../../i18n/validationSchema';
import {gs} from '../../styles/globalStyles';
import {useDebtorForm, type EditedDebtor} from '../../hooks/useDebtorForm';

interface DebtorEntryProps {
  /** The debtor being edited; absent when adding one. */
  editing?: EditedDebtor;
}

const DebtorEntry: React.FC<DebtorEntryProps> = ({editing}) => {
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
    <PrimaryView colors={colors} style={gs.justifyBetween} dismissKeyboardOnTouch>
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
    </PrimaryView>
  );
};

export default memo(DebtorEntry);
