import {ScrollView, Switch, TouchableOpacity, View} from 'react-native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Icon} from '../../../../ui/atoms/Icons';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {useSettings} from './useSettings';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {getWeekdayNames} from '../../../../platform/dateFormat';
import {gs, hitSlop} from '../../../../ui/globalStyles';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {SettingsRow} from '../../components/SettingsRow';
import {SettingsSection} from '../../components/SettingsSection';
import {logRejection} from '../../../../platform/errorLog';
import {useExportFile} from './useExportFile';
import {useSettingsSheets} from './useSettingsSheets';
import {MigrationRetryCard} from './MigrationRetryCard';

export const SettingsScreen = () => {
  const {t} = useTranslation();
  const settings = useSettings();
  const {appVersion, colors, userName, preferences, budget, links, data} = settings;
  const formatAmount = useFormatAmount();
  const {exportData, exportCsvFile} = useExportFile(data.onExportResult, data.requestStorageViaDialog);
  const {
    openBudgetSheet,
    openCurrencySheet,
    openNoiseFloor,
    openProInfo,
    openWeekStartPicker,
    openThemePicker,
    openNameSheet,
    openLanguagePicker,
  } = useSettingsSheets(settings);
  const weekStartLabel = getWeekdayNames()[preferences.weekStart.day === 'monday' ? 1 : 0];

  const handleOpenDiagnostics = useCallback(() => {
    navigate('DiagnosticsScreen');
  }, []);

  // Deliberately NOT dismissKeyboardOnTouch: this screen has no text input
  // (name, currency and budget are all edited in sheets), and the wrapper it
  // adds swallows the touch responder before the ScrollView can have it — see
  // the note in PrimaryView.
  return (
    <PrimaryView colors={colors}>
      <DataErrorBanner domains={['budget', 'category', 'currency']} />
      <View style={[gs.rowCenter, gs.gap10, gs.mt5p]}>
        <TouchableOpacity
          onPress={() => goBack()}
          hitSlop={hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}>
          <Icon name="arrow-left" size={22} color={colors.primaryText} />
        </TouchableOpacity>
        <PrimaryText size={22} weight="semibold" accessibilityRole="header">
          {t('settings.title')}
        </PrimaryText>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={gs.pb80}>
        <MigrationRetryCard onRetry={data.retryMigrations} />

        <SettingsSection title={t('settings.sectionPersonalization')}>
          <SettingsRow
            icon="sun-moon"
            label={t('settings.theme')}
            value={
              preferences.theme.mode === 'light'
                ? t('settings.themeLight')
                : preferences.theme.mode === 'dark'
                  ? t('settings.themeDark')
                  : t('settings.themeSystem')
            }
            onPress={openThemePicker}
          />
          <SettingsRow icon="user" label={t('settings.name')} value={userName} onPress={openNameSheet} />
          <SettingsRow
            icon="banknote"
            label={t('settings.currency')}
            onPress={openCurrencySheet}
            valueNode={
              <View style={gs.itemsEnd}>
                <PrimaryText size={13} color={colors.secondaryText} variant="number">
                  {preferences.currency.symbol}
                </PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText}>
                  {preferences.currency.name}
                </PrimaryText>
              </View>
            }
          />
          <SettingsRow
            icon="target"
            label={t('settings.budget')}
            // Names the month it edits: the one Home and Reports show, which may not be this month.
            subtitle={t('settings.budgetSubtitleMonth', {month: budget.monthLabel})}
            value={budget.current ? formatAmount(budget.current.amount) : undefined}
            onPress={openBudgetSheet}
          />
          <SettingsRow
            icon="globe"
            label={t('settings.language')}
            value={t('settings.currentLanguage')}
            onPress={openLanguagePicker}
          />
          <SettingsRow
            icon="calendar-days"
            label={t('settings.weekStart')}
            value={weekStartLabel}
            onPress={openWeekStartPicker}
          />
          {/* Issue #40: a stray swipe deleted a loan record. Off = edit/delete
              move behind a long-press menu on every list row. */}
          <SettingsRow
            icon="arrow-left-right"
            label={t('settings.swipeActions')}
            subtitle={t('settings.swipeActionsSubtitle')}
            onPress={() => preferences.swipeActions.set(!preferences.swipeActions.enabled)}
            hideChevron
            valueNode={
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Switch
                  value={preferences.swipeActions.enabled}
                  trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
                />
              </View>
            }
            accessibilityRole="switch"
            accessibilityState={{checked: preferences.swipeActions.enabled}}
          />
          {/* 2.8: off (the default) keeps amount fields a plain number keyboard. */}
          <SettingsRow
            icon="calculator"
            label={t('settings.calculator')}
            subtitle={t('settings.calculatorSubtitle')}
            onPress={() => preferences.calculator.set(!preferences.calculator.enabled)}
            hideChevron
            valueNode={
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Switch
                  value={preferences.calculator.enabled}
                  trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
                />
              </View>
            }
            accessibilityRole="switch"
            accessibilityState={{checked: preferences.calculator.enabled}}
          />
          {/* 2.8 widgets: off writes "••••" instead of every figure into the widget's storage. */}
          <SettingsRow
            icon="eye-off"
            label={t('settings.widgetAmounts')}
            subtitle={t('settings.widgetAmountsSubtitle')}
            onPress={() => preferences.widgetAmounts.set(!preferences.widgetAmounts.shown)}
            hideChevron
            valueNode={
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Switch
                  value={preferences.widgetAmounts.shown}
                  trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
                />
              </View>
            }
            accessibilityRole="switch"
            accessibilityState={{checked: preferences.widgetAmounts.shown}}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sectionData')}>
          <SettingsRow
            icon="download"
            label={t('settings.exportData')}
            subtitle={t('settings.exportSubtitle')}
            onPress={() => logRejection(exportData())}
          />
          <SettingsRow
            icon="file-spreadsheet"
            label={t('settings.exportCsv')}
            subtitle={t('settings.exportCsvSubtitle')}
            onPress={() => logRejection(exportCsvFile())}
          />
          <SettingsRow
            icon="trash-2"
            label={t('settings.deleteAllData')}
            subtitle={t('settings.deleteSubtitle')}
            onPress={() => logRejection(data.deleteAllData(exportData))}
            destructive
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sectionAbout')}>
          <SettingsRow
            icon="bug"
            label={t('settings.reportBug')}
            subtitle={t('settings.reportBugSubtitle')}
            onPress={links.reportBug}
          />
          <SettingsRow
            icon="message-circle"
            label={t('settings.community')}
            subtitle={t('settings.communitySubtitle')}
            onPress={links.community}
          />
          <SettingsRow
            icon="star"
            label={t('settings.rateApp')}
            subtitle={t('settings.rateAppSubtitle')}
            onPress={links.rateApp}
          />
          <SettingsRow
            icon="code"
            label={t('settings.sourceCode')}
            subtitle={t('settings.sourceCodeSubtitle')}
            onPress={links.github}
          />
          <SettingsRow
            icon="activity"
            label={t('settings.diagnostics')}
            subtitle={t('settings.diagnosticsSubtitle')}
            onPress={handleOpenDiagnostics}
          />
          <SettingsRow
            icon="wifi-off"
            label={t('settings.whatLeavesDevice')}
            subtitle={t('settings.whatLeavesDeviceSubtitle')}
            onPress={openNoiseFloor}
          />
          <SettingsRow icon="shield" label={t('settings.privacyPolicy')} onPress={links.privacyPolicy} />
          <SettingsRow icon="file-text" label={t('settings.termsAndConditions')} onPress={links.terms} />
          <SettingsRow
            icon="sparkles"
            label={t('settings.zeroPro')}
            subtitle={t('settings.zeroProSubtitle')}
            onPress={openProInfo}
          />
          <SettingsRow icon="info" label={t('settings.version')} value={`v${appVersion}`} />
        </SettingsSection>

        <View style={[gs.mt20, gs.mb10, gs.center, gs.gap2]}>
          <PrimaryText size={11} color={colors.secondaryText}>
            {t('settings.footerTagline')}
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText}>
            {t('settings.footerMadeWith')}
          </PrimaryText>
        </View>
      </ScrollView>
    </PrimaryView>
  );
};
