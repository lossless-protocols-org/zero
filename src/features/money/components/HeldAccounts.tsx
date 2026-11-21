import React from 'react';
import {AccountSections} from '../../../ui/molecules/AccountSections';
import {useNetWorth} from '../../../ui/hooks/useNetWorth';
import {navigate} from '../../../platform/navigationUtils';
import type {AccountBalance} from '../../../data/services/netWorthService';
import {HeldCard} from './HeldCard';
import {NetWorthLine} from './NetWorthLine';

const HELD_CLASSES = ['spend', 'save'] as const;

const openAccount = (account: AccountBalance) => navigate('AccountScreen', {accountId: account.accountId});

/**
 * The Money tab's Accounts view (Pro; approved A2, round two item 4): what
 * is in hand, then the accounts to spend from and the money put away, and
 * net worth as one quiet line at the foot. A class with no account has no
 * section (world review W7). Cards and loans are owed and live on the Debts
 * tab. Mounted only with accounts on.
 */
export const HeldAccounts: React.FC = () => {
  const {worth} = useNetWorth(true);
  if (!worth) {
    return null;
  }
  return (
    <>
      <HeldCard accounts={worth.accounts} />
      <AccountSections classes={HELD_CLASSES} accounts={worth.accounts} onOpen={openAccount} />
      <NetWorthLine total={worth.total} />
    </>
  );
};
