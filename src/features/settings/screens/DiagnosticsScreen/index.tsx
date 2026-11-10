import {Linking, ScrollView, Share, TouchableOpacity, View} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {Icon} from '../../../../ui/atoms/Icons';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useDialog} from '../../../../ui/context/DialogContext';
import {
  buildErrorMailto,
  clearErrorLog,
  formatErrorReport,
  getErrorLog,
  type ErrorLogEntry,
  type ReportMeta,
  appendErrorLog,
} from '../../../../platform/errorLog';
import {goBack} from '../../../../platform/navigationUtils';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {gs, hitSlop} from '../../../../ui/globalStyles';
import {getReportMeta} from '../../../../platform/reportMeta';

/**
 * Reads the on-device error log. Nothing here is transmitted anywhere — the
 * log is a local MMKV ring buffer (20 entries) that the app has always
 * written to and, until now, had no way to read back.
 */
export const DiagnosticsScreen = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showDialog, showAlert} = useDialog();
  const [entries, setEntries] = useState(() => getErrorLog());

  // Same facts the post-crash prompt attaches, so reports look alike whoever sends them.
  const meta = useMemo<ReportMeta>(getReportMeta, []);

  // Nothing is sent automatically: this hands the text to the OS share sheet
  // only when the user taps, and only they choose where it goes.
  const handleShare = useCallback(async () => {
    const payload = formatErrorReport(entries, meta);
    try {
      await Share.share({message: payload, title: t('diagnostics.title')});
    } catch (error) {
      appendErrorLog(error, false);
    }
  }, [entries, meta, t]);

  // A mailto: hand-off to whatever mail app the user has. If there is none,
  // say so instead of failing silently — the user came here to get a report out.
  const openMail = useCallback(
    async (forEntries: ErrorLogEntry[]) => {
      try {
        await Linking.openURL(buildErrorMailto(forEntries, meta));
      } catch {
        await showAlert({type: 'error', message: t('diagnostics.noMailApp')});
      }
    },
    [meta, showAlert, t],
  );

  const handleEmailAll = useCallback(() => openMail(entries), [entries, openMail]);

  const handleClear = useCallback(async () => {
    const confirmed = await showDialog({
      type: 'warning',
      message: t('diagnostics.clearConfirm'),
    });
    if (!confirmed) {
      return;
    }
    if (!clearErrorLog()) {
      await showAlert({type: 'error', message: t('diagnostics.clearFailed')});
      return;
    }
    setEntries([]);
  }, [showDialog, showAlert, t]);

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
          <View style={[gs.rowCenter, gs.gap10, gs.mb10, gs.wrap]}>
            <TouchableOpacity
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={t('diagnostics.share')}
              style={[gs.rowCenter, gs.gap6, gs.px14, gs.py10, gs.rounded8, {backgroundColor: colors.containerColor}]}>
              <Icon name="share-2" size={14} color={colors.primaryText} />
              <PrimaryText size={12} weight="medium">
                {t('diagnostics.share')}
              </PrimaryText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEmailAll}
              accessibilityRole="button"
              accessibilityLabel={t('diagnostics.email')}
              style={[gs.rowCenter, gs.gap6, gs.px14, gs.py10, gs.rounded8, {backgroundColor: colors.containerColor}]}>
              <Icon name="at-sign" size={14} color={colors.primaryText} />
              <PrimaryText size={12} weight="medium">
                {t('diagnostics.email')}
              </PrimaryText>
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
              .map((entry, index) => (
                <View
                  // Timestamp alone can repeat (two fatals in one second); the
                  // position in the reversed list is what makes the key unique.
                  key={`${index}-${entry.timestamp}`}
                  style={[gs.rounded12, gs.px14, gs.py12, gs.mb8, {backgroundColor: colors.containerColor}]}>
                  <View style={[gs.rowBetweenCenter, gs.mb5]}>
                    <PrimaryText
                      size={11}
                      weight="semibold"
                      color={entry.fatal ? colors.accentOrange : colors.secondaryText}>
                      {entry.fatal ? t('diagnostics.fatal') : t('diagnostics.error')}
                    </PrimaryText>
                    <View style={[gs.rowCenter, gs.gap10]}>
                      <PrimaryText size={11} color={colors.secondaryText} variant="number">
                        {formatDisplayDate(entry.timestamp, 'dateTime')}
                      </PrimaryText>
                      <TouchableOpacity
                        onPress={() => openMail([entry])}
                        accessibilityRole="button"
                        accessibilityLabel={t('diagnostics.emailEntry')}
                        hitSlop={hitSlop}>
                        <Icon name="at-sign" size={14} color={colors.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <PrimaryText size={12} selectable>
                    {entry.repeats ? `${entry.message} (×${entry.repeats + 1})` : entry.message}
                  </PrimaryText>
                </View>
              ))}
          </ScrollView>
        </>
      )}
    </PrimaryView>
  );
};
