import React, {useState} from 'react';
import {ScrollView, Switch, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {AmountInput} from '../../../../ui/atoms/AmountInput';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {Icon} from '../../../../ui/atoms/Icons';
import {CategoryContainer} from '../../../../ui/molecules/CategoryContainer';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {displayAccountName} from '../../../../i18n/displayNames';
import {expenseDescriptionSchema} from '../../../../i18n/validationSchema';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {toDayKey} from '../../../../domain/dates';
import {CADENCES, MAX_INTERVAL, RULE_TARGETS} from '../../../../domain/recurrence';
import type {HomeStackParamList} from '../../../../navigation/types';
import {useRuleForm} from '../../hooks/useRuleForm';
import {ChoiceChips} from '../../../../ui/molecules/ChoiceChips';
import {CADENCE_LABEL, REMIND_CHOICES, TARGET_LABEL, scheduleText} from '../../ruleCopy';
import {gs} from '../../../../ui/globalStyles';

/** Add or edit something that repeats: what it is, how much, where, how often, from when, and a reminder. */
export const RuleFormScreen = () => {
  const ruleId = useRoute<RouteProp<HomeStackParamList, 'RuleFormScreen'>>().params?.ruleId;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const form = useRuleForm(ruleId);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const selected = form.categories.filter(category => category.id === form.categoryId);
  const accountField = (label: string, name: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, name].join(', ')}
      style={[gs.minTouch, gs.mb10, gs.px14, gs.rounded12, {backgroundColor: colors.containerColor}]}>
      <View style={[gs.rowBetweenCenter, gs.py8]}>
        <PrimaryText size={12} color={colors.secondaryText}>
          {label}
        </PrimaryText>
        <View style={[gs.rowCenter, gs.gap6]}>
          <PrimaryText size={15} weight="medium">
            {name}
          </PrimaryText>
          <Icon name="chevron-right" size={16} color={colors.secondaryText} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <PrimaryView colors={colors}>
      {/* Longer than a screen: it scrolls (FormScroll is one screen tall in portrait, for the short entry forms). */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gs.pb80}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader
            onPress={goBack}
            colors={colors}
            text={form.isEditing ? t('recurring.editTitle') : t('recurring.addTitle')}
          />
        </View>

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('recurring.targetLabel')}
        </PrimaryText>
        <ChoiceChips
          choices={RULE_TARGETS.map(key => ({key, label: t(TARGET_LABEL[key])}))}
          value={form.target}
          onChange={form.setTarget}
        />

        <CustomInput
          colors={colors}
          input={form.title}
          setInput={form.setTitle}
          placeholder={t('recurring.titlePlaceholder')}
          label={t('recurring.titleLabel')}
          schema={expenseDescriptionSchema}
          returnKeyType="done"
        />

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
          {t('recurring.amountLabel')}
        </PrimaryText>
        {form.varies ? null : (
          <AmountInput
            value={form.amount}
            onChangeText={form.setAmount}
            returnKeyType="done"
            accessibilityLabel={t('recurring.amountLabel')}
            style={gs.mb10}
          />
        )}
        <TouchableOpacity
          onPress={() => form.setVaries(!form.varies)}
          activeOpacity={0.6}
          accessibilityRole="switch"
          accessibilityState={{checked: form.varies}}
          accessibilityLabel={[t('recurring.varies'), t('recurring.variesHint')].join('. ')}
          style={[gs.minTouch, gs.rowBetweenCenter, gs.gap10, gs.mb15]}>
          <View style={gs.flexShrink}>
            <PrimaryText size={14}>{t('recurring.varies')}</PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText}>
              {t('recurring.variesHint')}
            </PrimaryText>
          </View>
          {/* The row is the control; the switch only shows its state. */}
          <View pointerEvents="none">
            <Switch
              value={form.varies}
              trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
              importantForAccessibility="no-hide-descendants"
            />
          </View>
        </TouchableOpacity>

        {/* What makes it a recurring entry comes straight after what it is: how often, and from when. */}
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('recurring.repeatsLabel')}
        </PrimaryText>
        <ChoiceChips
          choices={CADENCES.map(key => ({key, label: t(CADENCE_LABEL[key])}))}
          value={form.cadence}
          onChange={form.setCadence}
        />
        <View style={[gs.rowBetweenCenter, gs.mb15]}>
          <PrimaryText size={14}>{scheduleText(form.cadence, form.interval, t)}</PrimaryText>
          <View style={[gs.row, gs.gap8]}>
            <PrimaryButton
              onPress={() => form.setIntervalCount(Math.max(1, form.interval - 1))}
              colors={colors}
              buttonTitle="−"
              variant="outline"
              size="sm"
              fullWidth={false}
              disabled={form.interval <= 1}
            />
            <PrimaryButton
              onPress={() => form.setIntervalCount(Math.min(MAX_INTERVAL, form.interval + 1))}
              colors={colors}
              buttonTitle="+"
              variant="outline"
              size="sm"
              fullWidth={false}
            />
          </View>
        </View>

        <DatePicker
          setShowDatePicker={setShowStart}
          createdAt={form.startPicker}
          showDatePicker={showStart}
          setCreatedAt={form.setStartPicker}
          label={t('recurring.startLabel')}
        />

        {form.target === 'transfer' ? (
          <>
            {accountField(t('recurring.fromLabel'), form.from ? displayAccountName(form.from.name, t) : '', () =>
              form.pickAccount('from'),
            )}
            {accountField(t('recurring.toLabel'), form.to ? displayAccountName(form.to.name, t) : '', () =>
              form.pickAccount('to'),
            )}
          </>
        ) : (
          <>
            {accountField(t('recurring.accountLabel'), form.from ? displayAccountName(form.from.name, t) : '', () =>
              form.pickAccount('from'),
            )}
            <PrimaryText size={12} color={colors.secondaryText} style={[gs.mb8, gs.mt5]}>
              {t('recurring.categoryLabel')}
            </PrimaryText>
            <CategoryContainer
              categories={form.categories}
              colors={colors}
              selectedCategories={selected}
              toggleCategorySelection={category => form.setCategoryId(category.id ?? '')}
            />
          </>
        )}

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('recurring.endLabel')}
        </PrimaryText>
        <ChoiceChips
          choices={[
            {key: 'never', label: t('recurring.noEnd')},
            {key: 'on', label: t('recurring.pickEnd')},
          ]}
          value={form.endDate === null ? 'never' : 'on'}
          onChange={key => form.setEndDate(key === 'never' ? null : (form.endDate ?? toDayKey(form.startPicker)))}
        />
        {form.endDate !== null ? (
          <DatePicker
            setShowDatePicker={setShowEnd}
            createdAt={`${form.endDate}T09:00:00`}
            showDatePicker={showEnd}
            setCreatedAt={value => form.setEndDate(toDayKey(value))}
            label={t('recurring.endLabel')}
          />
        ) : null}

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('recurring.remindLabel')}
        </PrimaryText>
        <ChoiceChips
          choices={REMIND_CHOICES.map(key => ({
            key,
            label:
              key === null
                ? t('recurring.remindNone')
                : key === 0
                  ? t('recurring.remindSameDay')
                  : t('recurring.remindDaysBefore', {count: key}),
          }))}
          value={form.remindDaysBefore}
          onChange={form.setRemindDaysBefore}
        />

        <View style={[gs.mt5, gs.mb20]}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={form.isEditing ? t('common.update') : t('recurring.add')}
            disabled={!form.isValid || form.saving}
          />
        </View>
        {form.loaded ? (
          <ListSection style={gs.mb20}>
            <ListRow
              icon="repeat"
              title={form.loaded.status === 'paused' ? t('recurring.resume') : t('recurring.pause')}
              onPress={() => logRejection(form.togglePaused())}
              chevron={false}
            />
            <ListRow
              icon="trash-2"
              title={t('recurring.delete')}
              onPress={() => logRejection(form.remove())}
              chevron={false}
            />
          </ListSection>
        ) : null}
      </ScrollView>
    </PrimaryView>
  );
};
