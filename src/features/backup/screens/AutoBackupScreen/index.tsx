import React, {useState} from 'react';
import {Platform, ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {ParseKeys} from 'i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {ChoiceChips} from '../../../../ui/molecules/ChoiceChips';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {Icon} from '../../../../ui/atoms/Icons';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {KEEP_DAYS_CHOICES, type BackupStatus} from '../../../../platform/backupPreferences';
import type {FolderState} from '../../../../data/backup/vault';
import {gs} from '../../../../ui/globalStyles';
import {useAutoBackup} from '../../hooks/useAutoBackup';
import {PassphraseFields} from '../../components/PassphraseFields';
import {passphraseProblem} from '../../lib/passphrase';

const VOLUME_LABEL: Record<string, ParseKeys> = {
  phone: 'autoBackup.volumePhone',
  sdCard: 'autoBackup.volumeSdCard',
  device: 'autoBackup.volumeDevice',
  icloud: 'autoBackup.volumeIcloud',
};

const PROBLEM: Partial<Record<BackupStatus, ParseKeys>> = {
  folderLost: 'autoBackup.statusFolderLost',
  noKey: 'autoBackup.statusNoKey',
  failed: 'autoBackup.statusFailed',
};

/**
 * Automatic backup (3.0, plan P10; Pro; UX revamp v2). Off: what it is in
 * three plain facts, then a folder and a passphrase, with the one thing that
 * cannot be undone said outright and ticked before it turns on. On: a status
 * that says the good news plainly, or the problem with its fix beside it;
 * then the settings as rows. The files stay in the folder whatever happens here.
 */
export const AutoBackupScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const backup = useAutoBackup();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  // The one place the app slows the user down on purpose: a lost passphrase loses every backup.
  const [written, setWritten] = useState(false);
  const folderText = (folder: FolderState): string =>
    folder.state === 'none'
      ? ''
      : [VOLUME_LABEL[folder.volume] ? t(VOLUME_LABEL[folder.volume] as ParseKeys) : '', folder.path]
          .filter(Boolean)
          .join(' · ');
  const problem = backup.on
    ? backup.folder.state === 'lost'
      ? PROBLEM.folderLost
      : PROBLEM[backup.status]
    : undefined;
  const card = [gs.p15, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}];
  const busy = backup.busy !== 'none';
  const problemText = problem ? t(problem) : '';
  // The fix sits with the problem: a lost folder is chosen again, a lost key is set again.
  const fix =
    !backup.on || !problem
      ? null
      : backup.folder.state === 'lost'
        ? {title: t('autoBackup.chooseAgain'), onPress: () => logRejection(backup.chooseFolder())}
        : backup.status === 'noKey'
          ? {title: t('autoBackup.setAgain'), onPress: () => navigate('BackupPassphraseScreen')}
          : {title: t('autoBackup.backUpNow'), onPress: () => logRejection(backup.backUp())};
  const setupBlocked =
    backup.folder.state !== 'ok'
      ? t('autoBackup.needFolder')
      : passphraseProblem(first, second) === null && !written
        ? t('autoBackup.needWritten')
        : '';

  return (
    <PrimaryView colors={colors}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gs.pb80}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={t('autoBackup.title')} />
        </View>

        {backup.on ? (
          <>
            <View style={card} accessibilityLiveRegion="polite">
              <View style={[gs.rowCenter, gs.gap10]}>
                <View
                  style={[
                    gs.size36,
                    gs.center,
                    gs.rounded10,
                    {backgroundColor: problem ? colors.iconContainer : colors.accentGreen},
                  ]}>
                  <Icon
                    name={problem ? 'alert-circle' : 'check'}
                    size={18}
                    color={problem ? colors.accentOrange : colors.buttonText}
                  />
                </View>
                <View style={gs.flex1}>
                  <PrimaryText size={15} weight="semibold">
                    {backup.lastAt > 0
                      ? t('autoBackup.backedUpAt', {when: formatDisplayDate(backup.lastAt, 'dateTime')})
                      : t('autoBackup.never')}
                  </PrimaryText>
                  {backup.folder.state === 'ok' ? (
                    <PrimaryText size={11} color={colors.secondaryText}>
                      {t('autoBackup.filesCount', {count: backup.folder.files})}
                    </PrimaryText>
                  ) : null}
                </View>
              </View>
              {problem ? (
                <PrimaryText size={13} style={gs.mt10}>
                  {problemText}
                </PrimaryText>
              ) : null}
              <View style={gs.mt10}>
                <PrimaryButton
                  onPress={fix ? fix.onPress : () => logRejection(backup.backUp())}
                  colors={colors}
                  buttonTitle={
                    fix ? fix.title : backup.busy === 'backup' ? t('autoBackup.backingUp') : t('autoBackup.backUpNow')
                  }
                  variant={problem ? 'primary' : 'outline'}
                  size="sm"
                  loading={backup.busy === 'backup' || backup.busy === 'folder'}
                  disabled={busy}
                />
              </View>
            </View>

            <ListSection title={t('autoBackup.settings')} style={gs.mb10}>
              <ListRow
                icon="folder-open"
                title={t('autoBackup.folderLabel')}
                subtitle={folderText(backup.folder)}
                value={t('autoBackup.change')}
                onPress={busy ? undefined : () => logRejection(backup.chooseFolder())}
              />
              <ListRow
                icon="lock"
                title={t('autoBackup.passphraseRow')}
                value={t('autoBackup.change')}
                onPress={busy ? undefined : () => navigate('BackupPassphraseScreen')}
              />
            </ListSection>

            <PrimaryText size={12} color={colors.secondaryText} style={[gs.mb8, gs.mt10]}>
              {t('autoBackup.keepLabel')}
            </PrimaryText>
            <ChoiceChips
              choices={KEEP_DAYS_CHOICES.map(key => ({key, label: t('autoBackup.keepDays', {count: Number(key)})}))}
              value={backup.keep}
              onChange={backup.setKeep}
            />
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mb5}>
              {t('autoBackup.whenHint')}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mb5}>
              {t('autoBackup.keepHint')}
            </PrimaryText>
            {/* Said once, plainly: a backup on the phone it protects does not survive losing the phone. */}
            <PrimaryText size={11} color={colors.secondaryText} style={gs.mb20}>
              {backup.folder.state !== 'none' && backup.folder.volume === 'icloud'
                ? t('autoBackup.icloudNote')
                : t('autoBackup.samePhone')}
            </PrimaryText>

            <ListSection>
              <ListRow
                icon="alert-circle"
                title={t('autoBackup.turnOff')}
                onPress={busy ? undefined : () => logRejection(backup.turnOff())}
                chevron={false}
              />
            </ListSection>
          </>
        ) : (
          <>
            <PrimaryText size={20} weight="semibold" style={gs.mb15}>
              {t('autoBackup.intro')}
            </PrimaryText>
            <ListSection style={gs.mb20}>
              <ListRow
                icon="folder-open"
                title={t('autoBackup.factFolder')}
                subtitle={t('autoBackup.factFolderMore')}
              />
              <ListRow icon="lock" title={t('autoBackup.factLocked')} subtitle={t('autoBackup.factLockedMore')} />
              <ListRow icon="calendar" title={t('autoBackup.factKeeps')} subtitle={t('autoBackup.factKeepsMore')} />
            </ListSection>

            <PrimaryText size={15} weight="semibold" style={gs.mb5}>
              {t('autoBackup.stepFolder')}
            </PrimaryText>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
              {Platform.OS === 'ios' ? t('autoBackup.folderHintIos') : t('autoBackup.folderHintAndroid')}
            </PrimaryText>
            <View style={card}>
              {backup.folder.state !== 'none' ? (
                <PrimaryText size={15} weight="medium" style={gs.mb10}>
                  {folderText(backup.folder)}
                </PrimaryText>
              ) : null}
              <PrimaryButton
                onPress={() => logRejection(backup.chooseFolder())}
                colors={colors}
                buttonTitle={
                  backup.folder.state === 'none' ? t('autoBackup.chooseFolder') : t('autoBackup.changeFolder')
                }
                variant={backup.folder.state === 'ok' ? 'outline' : undefined}
                size="sm"
                loading={backup.busy === 'folder'}
                disabled={busy}
              />
            </View>

            <PrimaryText size={15} weight="semibold" style={gs.mb5}>
              {t('autoBackup.stepPassphrase')}
            </PrimaryText>
            <PrimaryText size={12} color={colors.secondaryText} style={gs.mb10}>
              {t('autoBackup.passphraseHint')}
            </PrimaryText>
            <PassphraseFields first={first} setFirst={setFirst} second={second} setSecond={setSecond} disabled={busy} />
            <View style={card}>
              <View style={[gs.row, gs.gap10]}>
                <Icon name="key" size={18} color={colors.accentOrange} />
                <View style={gs.flex1}>
                  <PrimaryText size={14} weight="semibold">
                    {t('autoBackup.onlyThisOpens')}
                  </PrimaryText>
                  <PrimaryText size={12} color={colors.secondaryText}>
                    {t('autoBackup.cannotReset')}
                  </PrimaryText>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setWritten(value => !value)}
                activeOpacity={0.6}
                accessibilityRole="checkbox"
                accessibilityState={{checked: written}}
                accessibilityLabel={t('autoBackup.writtenDown')}
                style={[gs.minTouch, gs.rowCenter, gs.gap10, gs.mt8]}>
                <View
                  style={[
                    gs.size24,
                    gs.center,
                    gs.rounded5,
                    gs.border2,
                    {borderColor: colors.primaryText},
                    written && {backgroundColor: colors.primaryText},
                  ]}>
                  {written ? <Icon name="check" size={16} color={colors.buttonText} /> : null}
                </View>
                <PrimaryText size={14} weight="medium">
                  {t('autoBackup.writtenDown')}
                </PrimaryText>
              </TouchableOpacity>
            </View>
            <PrimaryButton
              onPress={() => logRejection(backup.turnOn(first))}
              colors={colors}
              buttonTitle={backup.busy === 'setup' ? t('autoBackup.settingUp') : t('autoBackup.turnOn')}
              loading={backup.busy === 'setup'}
              disabled={backup.folder.state !== 'ok' || passphraseProblem(first, second) !== null || !written || busy}
            />
            {setupBlocked ? (
              <PrimaryText size={12} color={colors.secondaryText} style={gs.mt8} accessibilityLiveRegion="polite">
                {setupBlocked}
              </PrimaryText>
            ) : null}
          </>
        )}
      </ScrollView>
    </PrimaryView>
  );
};
