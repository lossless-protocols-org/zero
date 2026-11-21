import React, {useState} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {DatePicker} from '../../../../ui/atoms/DatePicker';
import {ChoiceChips} from '../../../../ui/molecules/ChoiceChips';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAccountGroups} from '../../../../ui/hooks/useAccountGroups';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {
  ACCOUNT_CLASSES,
  ACCOUNT_KIND_MAX,
  ACCOUNT_NAME_MAX,
  accountKindKey,
  sideOf,
  type AccountClass,
} from '../../../../domain/accounts';
import {toDayKey} from '../../../../domain/dates';
import type {ParseKeys} from 'i18next';
import type {HomeStackParamList} from '../../../../navigation/types';
import {REPAY_CADENCES, useAccountForm, type RepayCadence} from '../../hooks/useAccountForm';
import {CLASS_LABEL, CLASS_MEANING} from '../../../../ui/accountWords';
import {gs} from '../../../../ui/globalStyles';

const ADD_TITLE: Record<AccountClass, ParseKeys> = {
  spend: 'accounts.addSpend',
  save: 'accounts.addSave',
  card: 'accounts.addCard',
  loan: 'accounts.addLoan',
};
const CADENCE_LABEL: Record<RepayCadence, ParseKeys> = {
  weekly: 'accounts.everyWeek',
  twoWeeks: 'accounts.everyTwoWeeks',
  monthly: 'accounts.everyMonth',
};

/**
 * Add or edit an account (approved A2/A3; round two item 8; world review
 * W2 to W5). What it is was chosen at the plus, so the form is titled by it
 * and opens on the one thing the user knows, its name; then what it holds or
 * what is owed today (no minus sign to type for a card or a loan), and the
 * group, picked like a category or typed new. The day the figure is from is
 * a quiet link, for the rare case. A new loan may give its repayment and how
 * often it is paid. An edit may move the account between the two classes of
 * its own side. Currency is always the user's.
 */
export const AccountFormScreen = () => {
  const params = useRoute<RouteProp<HomeStackParamList, 'AccountFormScreen'>>().params;
  const accountId = params?.accountId;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const form = useAccountForm(accountId, params?.accountClass);
  const groups = useAccountGroups();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNextPicker, setShowNextPicker] = useState(false);
  const [typingGroup, setTypingGroup] = useState(false);
  const kindKey = accountKindKey(form.kind);
  const offered = groups.byClass[form.accountClass];
  // A group of the user's own that is not among the chips is shown in the field it was typed in.
  const ownWord = form.kind.trim() !== '' && !offered.some(group => group.key === kindKey);
  const sameSide = ACCOUNT_CLASSES.filter(candidate => sideOf(candidate) === sideOf(form.accountClass));
  const amountLabel = form.isEditing
    ? form.owed
      ? t('accounts.openingOwed')
      : form.accountClass === 'save'
        ? t('accounts.openingWorth')
        : t('accounts.openingLabel')
    : form.owed
      ? t('accounts.todayOwed')
      : form.accountClass === 'save'
        ? t('accounts.todayWorth')
        : t('accounts.todayBalance');

  return (
    <PrimaryView colors={colors}>
      {/* Longer than a screen: it scrolls (FormScroll is one screen tall in portrait, for the short entry forms). */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gs.pb80}>
        <View style={[gs.mb10, gs.mt20]}>
          <AppHeader
            onPress={goBack}
            colors={colors}
            text={form.isEditing ? t('accounts.editTitle') : t(ADD_TITLE[form.accountClass])}
          />
        </View>
        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb15}>
          {t(CLASS_MEANING[form.accountClass])}
        </PrimaryText>

        {form.isEditing ? (
          <ChoiceChips
            choices={sameSide.map(key => ({key, label: t(CLASS_LABEL[key])}))}
            value={form.accountClass}
            onChange={accountClass => {
              form.setAccountClass(accountClass);
              form.setKind('');
            }}
          />
        ) : null}

        <CustomInput
          colors={colors}
          input={form.name}
          setInput={form.setName}
          placeholder={t('accounts.namePlaceholder')}
          label={t('accounts.nameLabel')}
          maxLength={ACCOUNT_NAME_MAX}
          autoCapitalize="words"
        />

        <CustomInput
          colors={colors}
          input={form.opening}
          setInput={form.setOpening}
          placeholder="0"
          label={amountLabel}
          keyboardType={form.owed ? 'decimal-pad' : 'numbers-and-punctuation'}
        />
        {form.owed ? (
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mb15}>
            {t('accounts.openingOwedHint')}
          </PrimaryText>
        ) : null}

        <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
          {t('accounts.groupLabel')}
        </PrimaryText>
        <View style={[gs.row, gs.wrap, gs.gap8, gs.mb15]}>
          {offered.map(group => {
            const selected = group.key === kindKey;
            return (
              <TouchableOpacity
                key={group.key}
                onPress={() => {
                  setTypingGroup(false);
                  form.setKind(selected ? '' : group.label);
                }}
                accessibilityRole="button"
                accessibilityState={{selected}}
                accessibilityLabel={group.label}
                style={[
                  gs.py8,
                  gs.px14,
                  gs.rounded12,
                  gs.minTouch,
                  gs.center,
                  {backgroundColor: selected ? colors.primaryText : colors.secondaryAccent},
                ]}>
                <PrimaryText size={13} weight="semibold" color={selected ? colors.buttonText : colors.secondaryText}>
                  {group.label}
                </PrimaryText>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              setTypingGroup(true);
              if (!ownWord) {
                form.setKind('');
              }
            }}
            accessibilityRole="button"
            accessibilityState={{selected: typingGroup || ownWord}}
            accessibilityLabel={t('accounts.groupNew')}
            testID="group-new"
            style={[
              gs.py8,
              gs.px14,
              gs.rounded12,
              gs.minTouch,
              gs.center,
              {backgroundColor: typingGroup || ownWord ? colors.primaryText : colors.secondaryAccent},
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={typingGroup || ownWord ? colors.buttonText : colors.secondaryText}>
              {t('accounts.groupNew')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
        {typingGroup || ownWord ? (
          <CustomInput
            colors={colors}
            input={form.kind}
            setInput={form.setKind}
            placeholder={t('accounts.groupPlaceholder')}
            label={t('accounts.groupOwn')}
            maxLength={ACCOUNT_KIND_MAX}
            autoCapitalize="words"
          />
        ) : null}

        {form.asksRepay ? (
          <View>
            <CustomInput
              colors={colors}
              input={form.repay}
              setInput={form.setRepay}
              placeholder="0"
              label={t('accounts.repayLabel')}
              keyboardType="decimal-pad"
            />
            {form.repay.trim() !== '' ? (
              <>
                <PrimaryText size={12} color={colors.secondaryText} style={gs.mb8}>
                  {t('accounts.repayOften')}
                </PrimaryText>
                <ChoiceChips
                  choices={REPAY_CADENCES.map(key => ({key, label: t(CADENCE_LABEL[key])}))}
                  value={form.repayCadence}
                  onChange={form.setRepayCadence}
                />
                <DatePicker
                  setShowDatePicker={setShowNextPicker}
                  createdAt={`${form.repayNext}T09:00:00`}
                  showDatePicker={showNextPicker}
                  setCreatedAt={value => form.setRepayNext(toDayKey(value))}
                  label={t('accounts.repayNext')}
                  minDate={new Date()}
                />
              </>
            ) : null}
            <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt6, gs.mb15]}>
              {t('accounts.repayHint')}
            </PrimaryText>
          </View>
        ) : null}

        {form.openingDate !== null ? (
          <View style={gs.mb10}>
            <DatePicker
              setShowDatePicker={setShowDatePicker}
              createdAt={`${form.openingDate}T09:00:00`}
              showDatePicker={showDatePicker}
              setCreatedAt={value => form.setOpeningDate(toDayKey(value))}
              label={t('accounts.openingDateLabel')}
              maxDate={new Date()}
            />
          </View>
        ) : null}
        <TouchableOpacity
          onPress={() => form.setOpeningDate(form.openingDate === null ? toDayKey(new Date()) : null)}
          accessibilityRole="button"
          testID="other-day"
          style={[gs.minTouch, gs.mb10]}>
          <PrimaryText size={12} color={colors.secondaryText}>
            {form.openingDate === null ? t('accounts.otherDay') : t('accounts.otherDayOff')}
          </PrimaryText>
        </TouchableOpacity>

        <View style={gs.mt5}>
          <PrimaryButton
            onPress={() => logRejection(form.save())}
            colors={colors}
            buttonTitle={form.isEditing ? t('common.update') : t(ADD_TITLE[form.accountClass])}
            disabled={!form.isValid || form.saving || !form.ready}
          />
        </View>
      </ScrollView>
    </PrimaryView>
  );
};
