import React from 'react';
import {useTranslation} from 'react-i18next';
import {logRejection} from '../../../platform/errorLog';
import {useProRows} from '../hooks/useProRows';
import {SettingsRow} from './SettingsRow';
import {SettingsSection} from './SettingsSection';

/**
 * Settings → zero Pro (3.0). The first row is the only upgrade entry in the
 * app (plan rule 6): no badge, no banner, and its subtitle says where the
 * purchase stands rather than selling.
 */
export const ProSection: React.FC = () => {
  const {t} = useTranslation();
  const pro = useProRows();
  return (
    <SettingsSection title={t('settings.sectionPro')}>
      <SettingsRow icon="sparkles" label={t('pro.title')} subtitle={pro.status} onPress={pro.openUpgrade} />
      {pro.showManage ? (
        <SettingsRow
          icon="credit-card"
          label={t('pro.manage')}
          subtitle={t('pro.manageSubtitle')}
          onPress={() => logRejection(pro.manageSubscription())}
        />
      ) : null}
      {pro.showRestore ? (
        <SettingsRow
          icon="rotate-ccw"
          label={t('pro.restore')}
          subtitle={pro.restoring ? t('pro.loading') : t('pro.restoreSubtitle')}
          onPress={pro.restoring ? undefined : () => logRejection(pro.restore())}
        />
      ) : null}
      {pro.keptCount > 0 ? (
        <SettingsRow
          icon="archive"
          label={t('pro.keptTitle')}
          subtitle={t('pro.keptSubtitle', {count: pro.keptCount})}
          onPress={() => logRejection(pro.explainKept())}
        />
      ) : null}
      {pro.keptCount > 0 ? (
        <SettingsRow
          icon="trash-2"
          label={t('pro.keptRemove')}
          onPress={() => logRejection(pro.removeKept())}
          destructive
        />
      ) : null}
    </SettingsSection>
  );
};
