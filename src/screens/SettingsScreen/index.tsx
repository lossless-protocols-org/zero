import {ScrollView, Switch, TouchableOpacity, View} from 'react-native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import Icon from '../../components/atoms/Icons';
import {goBack, navigate} from '../../utils/navigationUtils';
import useSettings from './useSettings';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import useFormatAmount from '../../hooks/useFormatAmount';
import {getWeekdayNames} from '../../utils/dateUtils';
import {gs, hitSlop} from '../../styles/globalStyles';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {SettingsRow} from '../../components/atoms/SettingsRow';
import {SettingsSection} from '../../components/molecules/SettingsSection';
import {logRejection} from '../../utils/errorLog';
import {useExportFile} from './useExportFile';
import {useSettingsSheets} from './useSettingsSheets';
import {MigrationRetryCard} from './MigrationRetryCard';

const SettingsScreen = () => {
  const {t} = useTranslation();
  const settings = useSettings();
  const {
    appVersion,
    colors,
    selectedTheme,
    userName,
    currencySymbol,
    currencyName,
    handleReportBug,
    handleCommunity,
    handleRateNow,
    handleGithub,
    handlePrivacyPolicy,
    handleTermsAndConditions,
    handleDeleteAllData,
    handleExportResult,
    handleRetryMigrations,
    requestStorageViaDialog,
    currentBudget,
    swipeActionsEnabled,
    handleSwipeActionsToggle,
  } = settings;
  const formatAmount = useFormatAmount();
  const {exportData, exportCsvFile} = useExportFile(handleExportResult, requestStorageViaDialog);
  const {
    weekStart,
    openBudgetSheet,
    openCurrencySheet,
    openNoiseFloor,
    openWeekStartPicker,
    openThemePicker,
    openNameSheet,
    openLanguagePicker,
  } = useSettingsSheets(settings);
  const weekStartLabel = getWeekdayNames()[weekStart === 'monday' ? 1 : 0];

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
        <MigrationRetryCard onRetry={handleRetryMigrations} />

        <SettingsSection title={t('settings.sectionPersonalization')}>
          <SettingsRow
            icon="sun-moon"
            label={t('settings.theme')}
            value={
              selectedTheme === 'light'
                ? t('settings.themeLight')
                : selectedTheme === 'dark'
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
                  {currencySymbol}
                </PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText}>
                  {currencyName}
                </PrimaryText>
              </View>
            }
          />
          <SettingsRow
            icon="target"
            label={t('settings.budget')}
            subtitle={t('settings.budgetSubtitle')}
            value={currentBudget ? formatAmount(currentBudget.amount) : undefined}
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
            onPress={() => handleSwipeActionsToggle(!swipeActionsEnabled)}
            hideChevron
            valueNode={
              <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Switch
                  value={swipeActionsEnabled}
                  trackColor={{false: colors.secondaryAccent, true: colors.accentGreen}}
                />
              </View>
            }
            accessibilityRole="switch"
            accessibilityState={{checked: swipeActionsEnabled}}
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
            onPress={() => logRejection(handleDeleteAllData(exportData))}
            destructive
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sectionAbout')}>
          <SettingsRow
            icon="bug"
            label={t('settings.reportBug')}
            subtitle={t('settings.reportBugSubtitle')}
            onPress={handleReportBug}
          />
          <SettingsRow
            icon="message-circle"
            label={t('settings.community')}
            subtitle={t('settings.communitySubtitle')}
            onPress={handleCommunity}
          />
          <SettingsRow
            icon="star"
            label={t('settings.rateApp')}
            subtitle={t('settings.rateAppSubtitle')}
            onPress={handleRateNow}
          />
          <SettingsRow
            icon="code"
            label={t('settings.sourceCode')}
            subtitle={t('settings.sourceCodeSubtitle')}
            onPress={handleGithub}
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
          <SettingsRow icon="shield" label={t('settings.privacyPolicy')} onPress={handlePrivacyPolicy} />
          <SettingsRow icon="file-text" label={t('settings.termsAndConditions')} onPress={handleTermsAndConditions} />
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

export default SettingsScreen;
