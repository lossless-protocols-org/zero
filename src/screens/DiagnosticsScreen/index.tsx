import {Platform, ScrollView, Share, TouchableOpacity, View} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import AppHeader from '../../components/atoms/AppHeader';
import Icon from '../../components/atoms/Icons';
import EmptyState from '../../components/atoms/EmptyState';
import useThemeColors from '../../hooks/useThemeColors';
import {useDialog} from '../../context/DialogContext';
import {clearErrorLog, formatErrorReport, getErrorLog} from '../../utils/errorLog';
import {getAppVersion} from '../../utils/getVersion';
import {goBack} from '../../utils/navigationUtils';
import {formatDate} from '../../utils/dateUtils';
import {gs} from '../../styles/globalStyles';

/**
 * Reads the on-device error log. Nothing here is transmitted anywhere — the
 * log is a local MMKV ring buffer (20 entries) that the app has always
 * written to and, until now, had no way to read back.
 */
const DiagnosticsScreen = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showDialog} = useDialog();
  const [entries, setEntries] = useState(() => getErrorLog());

  // Nothing is sent automatically: this hands the text to the OS share sheet
  // only when the user taps, and only they choose where it goes.
  const handleShare = useCallback(async () => {
    // Same text the post-crash prompt shares, so reports look alike whoever sends them.
    const constants = Platform.constants as {Brand?: string; Model?: string; Release?: string};
    const payload = formatErrorReport(entries, {
      appVersion: getAppVersion(),
      os: Platform.OS,
      osVersion: constants.Release ?? String(Platform.Version),
      brand: constants.Brand,
      model: constants.Model,
    });
    try {
      await Share.share({message: payload, title: t('diagnostics.title')});
    } catch (error) {
      if (__DEV__) {
        console.error('Error sharing diagnostics:', error);
      }
    }
  }, [entries, t]);

  const handleClear = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'warning',
      message: t('diagnostics.clearConfirm'),
    });
    if (!confirmed) {
      return;
    }
    clearErrorLog();
    setEntries([]);
  }, [showDialog, t]);

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={() => goBack()} colors={colors} text={t('diagnostics.title')} />
      </View>

      <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
        {t('diagnostics.subtitle')}
      </PrimaryText>

      {entries.length === 0 ? (
        <EmptyState type="Insights" colors={colors} message={t('diagnostics.empty')} />
      ) : (
        <>
          <View style={[gs.rowCenter, gs.gap10, gs.mb10]}>
            <TouchableOpacity
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={t('diagnostics.share')}
              style={[gs.rowCenter, gs.gap6, gs.px14, gs.py10, gs.rounded8, {backgroundColor: colors.containerColor}]}>
              <Icon name="share-2" size={14} color={colors.primaryText} />
              <PrimaryText size={12} weight="medium">{t('diagnostics.share')}</PrimaryText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel={t('diagnostics.clear')}
              style={[gs.rowCenter, gs.gap6, gs.px14, gs.py10, gs.rounded8, {backgroundColor: colors.containerColor}]}>
              <Icon name="trash-2" size={14} color={colors.accentOrange} />
              <PrimaryText size={12} weight="medium" color={colors.accentOrange}>
                {t('diagnostics.clear')}
              </PrimaryText>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pb80}>
            {entries
              .slice()
              .reverse()
              .map(entry => (
                <View
                  key={`${entry.timestamp}-${entry.message}`}
                  style={[gs.rounded12, gs.px14, gs.py12, gs.mb8, {backgroundColor: colors.containerColor}]}>
                  <View style={[gs.rowBetweenCenter, gs.mb5]}>
                    <PrimaryText
                      size={11}
                      weight="semibold"
                      color={entry.fatal ? colors.accentOrange : colors.secondaryText}>
                      {entry.fatal ? t('diagnostics.fatal') : t('diagnostics.error')}
                    </PrimaryText>
                    <PrimaryText size={11} color={colors.secondaryText} variant="number">
                      {formatDate(entry.timestamp, 'Do MMM YYYY, HH:mm')}
                    </PrimaryText>
                  </View>
                  <PrimaryText size={12} selectable>{entry.message}</PrimaryText>
                </View>
              ))}
          </ScrollView>
        </>
      )}
    </PrimaryView>
  );
};

export default DiagnosticsScreen;
