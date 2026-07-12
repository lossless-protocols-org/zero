import {ScrollView, TouchableOpacity, View, Platform, Share} from 'react-native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import i18n from '../../i18n';
import Icon from '../../components/atoms/Icons';
import {goBack} from '../../utils/navigationUtils';
import useSettings from './useSettings';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import RNFS from 'react-native-fs';
import {generateUniqueKey, requestStoragePermission} from '../../utils/dataUtils';
import {getTimestamp} from '../../utils/dateUtils';
import {CURRENT_EXPORT_VERSION} from '../../backend/export/format';
import {SheetManager} from 'react-native-actions-sheet';
import {setLocaleOverride} from '../../utils/locale';
import {Colors} from '../../hooks/useThemeColors';
import {gs, hitSlop} from '../../styles/globalStyles';

interface SettingsRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  value?: string;
  valueNode?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  colors: Colors;
}

const SettingsRow: React.FC<SettingsRowProps> = ({icon, label, subtitle, value, valueNode, onPress, destructive, colors}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress}>
    <View style={[gs.rowCenter, gs.px14, gs.py12, gs.gap10]}>
      <View style={[gs.size32, gs.rounded8, gs.center, {backgroundColor: colors.secondaryAccent}]}>
        <Icon name={icon} size={16} color={destructive ? colors.accentOrange : colors.secondaryText} />
      </View>
      <View style={[gs.flex1, gs.gap2]}>
        <PrimaryText size={14} weight="medium" color={destructive ? colors.accentOrange : colors.primaryText}>
          {label}
        </PrimaryText>
        {subtitle ? (
          <PrimaryText size={11} color={colors.secondaryText}>{subtitle}</PrimaryText>
        ) : null}
      </View>
      {value ? (
        <PrimaryText size={13} color={colors.secondaryText}>{value}</PrimaryText>
      ) : null}
      {valueNode ?? null}
      {onPress ? <Icon name="chevron-right" size={14} color={colors.secondaryText} /> : null}
    </View>
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const {t} = useTranslation();
  const {
    appVersion,
    colors,
    handleThemeSelection,
    handleNameUpdate,
    handleCurrencyUpdate,
    selectedTheme,
    userName,
    currencySymbol,
    currencyName,
    handleReportBug,
    handleRateNow,
    handleGithub,
    handlePrivacyPolicy,
    handleTermsAndConditions,
    handleDeleteAllData,
    allData,
    handleExportResult,
    requestStorageViaDialog,
    isAppLockEnabled,
    isBiometricAvailable,
    toggleAppLock,
  } = useSettings();

  const handleOpenCurrencySheet = useCallback(() => {
    void SheetManager.show('currency-picker-sheet', {
      payload: {
        selectedCurrency: {code: '', name: currencyName, symbol: currencySymbol},
        onSelect: (currency: {code: string; name: string; symbol: string}) => {
          handleCurrencyUpdate(currency);
        },
      },
    });
  }, [currencyName, currencySymbol, handleCurrencyUpdate]);

  const exportData = async (dataToExport: unknown) => {
    try {
      if (!dataToExport) {
        handleExportResult(false);
        return;
      }

      const currentDateAndTime = getTimestamp();
      const fileName = `zero_v${CURRENT_EXPORT_VERSION}_${currentDateAndTime}.json`;
      const jsonData = JSON.stringify({key: generateUniqueKey(), version: CURRENT_EXPORT_VERSION, data: dataToExport}, null, 2);

      if (Platform.OS === 'ios') {
        const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;

        await RNFS.writeFile(path, jsonData, 'utf8');

        await Share.share({
          url: `file://${path}`,
          title: t('settings.exportShareTitle'),
        });

        handleExportResult(true);
      } else {
        const storagePermissionGranted = await requestStoragePermission();

        if (!storagePermissionGranted) {
          requestStorageViaDialog();
          return;
        }

        const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;

        await RNFS.writeFile(path, jsonData, 'utf8');
        handleExportResult(true);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving file:', error);
      }
      handleExportResult(false);
    }
  };

  const openThemePicker = useCallback(() => {
    void SheetManager.show('theme-picker-sheet', {
      payload: {
        currentTheme: selectedTheme,
        onSelect: (theme: string) => {
          handleThemeSelection(theme);
        },
      },
    });
  }, [selectedTheme, handleThemeSelection]);

  return (
    <PrimaryView colors={colors} dismissKeyboardOnTouch>
      <View style={[gs.rowCenter, gs.gap10, gs.mt5p]}>
        <TouchableOpacity onPress={() => goBack()} hitSlop={hitSlop}>
          <Icon name="arrow-left" size={22} color={colors.primaryText} />
        </TouchableOpacity>
        <PrimaryText size={22} weight="semibold">{t('settings.title')}</PrimaryText>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pb80}>
        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionPersonalization')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow
            colors={colors}
            icon="sun-moon"
            label={t('settings.theme')}
            value={selectedTheme === 'light' ? t('settings.themeLight') : selectedTheme === 'dark' ? t('settings.themeDark') : t('settings.themeSystem')}
            onPress={openThemePicker}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="user"
            label={t('settings.name')}
            value={userName}
            onPress={() => {
              void SheetManager.show('change-name-sheet', {
                payload: {
                  currentName: userName,
                  onUpdate: (newName: string) => {
                    handleNameUpdate(newName);
                  },
                },
              });
            }}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="banknote"
            label={t('settings.currency')}
            onPress={handleOpenCurrencySheet}
            valueNode={
              <View style={gs.itemsEnd}>
                <PrimaryText size={13} color={colors.secondaryText} variant="number">{currencySymbol}</PrimaryText>
                <PrimaryText size={10} color={colors.secondaryText}>{currencyName}</PrimaryText>
              </View>
            }
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="globe"
            label={t('settings.language')}
            value="English"
            onPress={() => {
              void SheetManager.show('language-picker-sheet', {
                payload: {
                  currentLanguage: i18n.language,
                  onSelect: (lang: string) => {
                    setLocaleOverride(lang === 'en' ? null : lang);
                  },
                },
              });
            }}
          />
          {isBiometricAvailable ? (
            <>
              <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
              <SettingsRow
                colors={colors}
                icon="fingerprint"
                label={t('settings.appLock')}
                subtitle={t('settings.appLockSubtitle')}
                onPress={() => toggleAppLock()}
                valueNode={
                  <View
                    style={[
                      gs.size16,
                      gs.roundedFull,
                      {backgroundColor: isAppLockEnabled ? colors.accentGreen : colors.secondaryText},
                    ]}
                  />
                }
              />
            </>
          ) : null}
        </View>

        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionData')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow
            colors={colors}
            icon="download"
            label={t('settings.exportData')}
            subtitle={t('settings.exportSubtitle')}
            onPress={() => exportData(allData)}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="trash-2"
            label={t('settings.deleteAllData')}
            subtitle={t('settings.deleteSubtitle')}
            onPress={() => handleDeleteAllData(() => exportData(allData))}
            destructive
          />
        </View>

        <PrimaryText
          size={11}
          weight="semibold"
          color={colors.accentGreen}
          style={[gs.mt20, gs.mb6, {letterSpacing: 0.8}]}>
          {t('settings.sectionAbout')}
        </PrimaryText>
        <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
          <SettingsRow
            colors={colors}
            icon="bug"
            label={t('settings.reportBug')}
            subtitle={t('settings.reportBugSubtitle')}
            onPress={handleReportBug}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="star"
            label={t('settings.rateApp')}
            subtitle={t('settings.rateAppSubtitle')}
            onPress={handleRateNow}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="code"
            label={t('settings.sourceCode')}
            subtitle={t('settings.sourceCodeSubtitle')}
            onPress={handleGithub}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="shield"
            label={t('settings.privacyPolicy')}
            onPress={handlePrivacyPolicy}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="file-text"
            label={t('settings.termsAndConditions')}
            onPress={handleTermsAndConditions}
          />
          <View style={[gs.mx16, {height: 1, backgroundColor: colors.secondaryAccent}]} />
          <SettingsRow
            colors={colors}
            icon="info"
            label={t('settings.version')}
            value={`v${appVersion}`}
          />
        </View>

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
