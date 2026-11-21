import React from 'react';
import {useTranslation} from 'react-i18next';
import {ListSection} from '../../../ui/molecules/ListSection';
import {ListRow} from '../../../ui/molecules/ListRow';
import {CLASS_ICON} from '../../../ui/accountWords';
import {logRejection} from '../../../platform/errorLog';
import {useMoveTally} from '../hooks/useMoveTally';
import {gs} from '../../../ui/globalStyles';

/**
 * On a card or loan tally's own screen, with Pro: the offer to make it a
 * full card or loan (approved model A2). Without Pro, or on a person, it
 * does not exist.
 */
export const MoveTally: React.FC<{debtorId: string}> = ({debtorId}) => {
  const {t} = useTranslation();
  const {offered, busy, move} = useMoveTally(debtorId);
  if (!offered) {
    return null;
  }
  return (
    <ListSection title={t('debts.moveTitle')} style={[gs.mx16, gs.mb15]}>
      <ListRow
        dynamicIcon={CLASS_ICON.card}
        title={t('debts.moveToCard')}
        subtitle={t('accounts.meansCard')}
        onPress={() => logRejection(move('card'))}
        dimmed={busy}
        chevron
      />
      <ListRow
        dynamicIcon={CLASS_ICON.loan}
        title={t('debts.moveToLoan')}
        subtitle={t('accounts.meansLoan')}
        onPress={() => logRejection(move('loan'))}
        dimmed={busy}
        chevron
      />
    </ListSection>
  );
};
