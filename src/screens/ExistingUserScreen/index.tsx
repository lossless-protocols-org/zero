import {ActivityIndicator, TouchableOpacity, View} from 'react-native';
import React, {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import Icon from '../../components/atoms/Icons';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import useExistingUser from './useExistingUser';
import {gs} from '../../styles/globalStyles';
import {logRejection} from '../../utils/errorLog';
import type {ThemeColors} from '../../hooks/useThemeColors';

const SyncStatusItem = memo(
  ({
    label,
    status,
    count,
    colors,
  }: {
    label: string;
    status: 'pending' | 'syncing' | 'done' | 'error';
    count?: number;
    colors: ThemeColors;
  }) => {
    const statusIcon = useMemo(() => {
      switch (status) {
        case 'syncing':
          return <ActivityIndicator size="small" color={colors.accentGreen} />;
        case 'done':
          return <Icon name="check-circle" size={18} color={colors.accentGreen} />;
        case 'error':
          return <Icon name="x-circle" size={18} color={colors.accentRed} />;
        default:
          return <Icon name="circle" size={18} color={colors.secondaryAccent} />;
      }
    }, [status, colors]);

    return (
      <View style={[gs.rowCenter, gs.py10, gs.borderBottom05, {borderBottomColor: colors.secondaryAccent}]}>
        {statusIcon}
        <PrimaryText
          size={13}
          style={[gs.ml12, gs.flex1]}
          color={status === 'done' ? colors.primaryText : colors.secondaryText}>
          {label}
        </PrimaryText>
        {status === 'done' && count !== undefined && count > 0 && (
          <PrimaryText size={12} color={colors.secondaryText} variant="number">
            {count}
          </PrimaryText>
        )}
      </View>
    );
  },
);

const ExistingUserScreen = () => {
  const {
    colors,
    importData,
    fileName,
    uploadMessage,
    reUpload,
    handleContinue,
    isSyncing,
    isSyncComplete,
    syncStatus,
    syncStats,
    syncError,
  } = useExistingUser();
  const {t} = useTranslation();

  const showSyncProgress = isSyncing || isSyncComplete;

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween}>
      <View>
        <View style={gs.pt10p}>
          <PrimaryText size={28} weight="bold">
            {t('existingUser.title')}
          </PrimaryText>
          <PrimaryText size={28} weight="bold">
            {t('existingUser.titleSuffix')}
          </PrimaryText>
        </View>

        <PrimaryText size={14} color={colors.secondaryText} style={gs.mt6}>
          {t('existingUser.subtitle')}
        </PrimaryText>

        <TouchableOpacity
          onPress={importData}
          disabled={isSyncing}
          activeOpacity={0.7}
          style={[gs.mt30, gs.py12, gs.px14, gs.rounded12, gs.rowCenter, {backgroundColor: colors.containerColor}]}>
          <View
            style={[
              gs.size40,
              gs.roundedFull,
              gs.center,
              gs.mr10,
              {backgroundColor: isSyncComplete ? colors.accentGreen : colors.secondaryAccent},
            ]}>
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.accentGreen} />
            ) : isSyncComplete ? (
              <Icon name="check" size={20} color={colors.buttonText} />
            ) : (
              <Icon name="upload" size={20} color={colors.secondaryText} />
            )}
          </View>
          <View style={gs.flex1}>
            {fileName ? (
              <>
                <PrimaryText size={13} weight="medium" numberOfLines={1}>
                  {fileName}
                </PrimaryText>
                <PrimaryText size={11} color={isSyncComplete ? colors.accentGreen : colors.secondaryText}>
                  {isSyncComplete ? t('existingUser.syncComplete') : t('existingUser.syncing')}
                </PrimaryText>
              </>
            ) : (
              <>
                <PrimaryText size={13} weight="medium">
                  {uploadMessage}
                </PrimaryText>
                <PrimaryText size={11} color={colors.secondaryText}>
                  {t('existingUser.tapToSelect')}
                </PrimaryText>
              </>
            )}
          </View>
        </TouchableOpacity>

        {fileName && !isSyncing && (
          <TouchableOpacity onPress={reUpload} style={gs.mt10}>
            <PrimaryText size={12} color={colors.accentOrange}>
              {t('existingUser.uploadDifferent')}
            </PrimaryText>
          </TouchableOpacity>
        )}

        {showSyncProgress && (
          <View style={gs.mt30}>
            <PrimaryText
              size={14}
              weight="semibold"
              color={isSyncComplete ? colors.accentGreen : colors.primaryText}
              style={gs.mb10}>
              {isSyncComplete ? t('existingUser.allDone') : t('existingUser.syncingData')}
            </PrimaryText>

            <SyncStatusItem label={t('existingUser.syncProfile')} status={syncStatus.user} colors={colors} />
            <SyncStatusItem
              label={t('existingUser.syncCategories')}
              status={syncStatus.categories}
              count={syncStats.categories}
              colors={colors}
            />
            <SyncStatusItem
              label={t('existingUser.syncExpenses')}
              status={syncStatus.expenses}
              count={syncStats.expenses}
              colors={colors}
            />
            <SyncStatusItem
              label={t('existingUser.syncDebtors')}
              status={syncStatus.debtors}
              count={syncStats.debtors}
              colors={colors}
            />
            <SyncStatusItem
              label={t('existingUser.syncDebts')}
              status={syncStatus.debts}
              count={syncStats.debts}
              colors={colors}
            />
            <SyncStatusItem
              label={t('existingUser.syncBudgets')}
              status={syncStatus.budgets}
              count={syncStats.budgets}
              colors={colors}
            />
            <SyncStatusItem label={t('existingUser.syncCurrency')} status={syncStatus.currencies} colors={colors} />

            {isSyncComplete && syncStats.autoCreated > 0 && (
              <PrimaryText size={11} color={colors.secondaryText} style={gs.mt10}>
                {t('existingUser.recoveredEntries', {count: syncStats.autoCreated})}
              </PrimaryText>
            )}
          </View>
        )}
      </View>

      <View>
        {syncError ? (
          <View style={[gs.rowCenter, gs.mb10]}>
            <Icon name="x-circle" size={16} color={colors.accentRed} />
            <PrimaryText size={13} color={colors.accentRed} style={[gs.ml8, gs.flex1]}>
              {syncError}
            </PrimaryText>
          </View>
        ) : null}
        <PrimaryButton
          onPress={() => logRejection(handleContinue())}
          colors={colors}
          buttonTitle={t('common.continue')}
          disabled={!isSyncComplete}
        />
      </View>
    </PrimaryView>
  );
};

export default ExistingUserScreen;
