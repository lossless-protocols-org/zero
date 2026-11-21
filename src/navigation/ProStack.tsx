import type React from 'react';
import {AccountsScreen} from '../features/accounts/screens/AccountsScreen';
import {AccountScreen} from '../features/accounts/screens/AccountScreen';
import {AccountFormScreen} from '../features/accounts/screens/AccountFormScreen';
import {GroupFormScreen} from '../features/accounts/screens/GroupFormScreen';
import {TransferScreen} from '../features/accounts/screens/TransferScreen';
import {ReconcileScreen} from '../features/accounts/screens/ReconcileScreen';
import {NetWorthScreen} from '../features/accounts/screens/NetWorthScreen';
import {RecurringScreen} from '../features/recurring/screens/RecurringScreen';
import {RuleFormScreen} from '../features/recurring/screens/RuleFormScreen';
import {ConfirmRecurringScreen} from '../features/recurring/screens/ConfirmRecurringScreen';
import {AutoBackupScreen} from '../features/backup/screens/AutoBackupScreen';
import {BackupPassphraseScreen} from '../features/backup/screens/BackupPassphraseScreen';
import {RangeReportScreen} from '../features/reports/pro/RangeReportScreen';
import {TrendsScreen} from '../features/reports/pro/TrendsScreen';

/** A Pro screen: its route name (also listed in `proLinks.ts`) and its component. */
export interface ProScreen {
  name: string;
  component: React.ComponentType;
}

/**
 * Every screen that exists only for Pro (3.0 law L8). This is the one module
 * allowed to import a Pro feature folder (`pro-features-behind-pro-stack`),
 * and `HomeStack` is the one module allowed to import this, which it mounts
 * only while Pro is applied. So a free user's navigator does not contain
 * these screens at all: there is nothing to lock.
 *
 * A phase adds its screens here and their names to `PRO_ROUTES`, in the same
 * commit. P8: accounts, transfers, reconcile, net worth. P9: recurring entries. P10: automatic backup.
 * P11: Reports for a custom range. P12: trends. (Both live in features/reports/pro: a `pro/` folder
 * inside a free feature is gated like a whole Pro feature.)
 */
export const PRO_SCREENS: readonly ProScreen[] = [
  {name: 'AccountsScreen', component: AccountsScreen},
  {name: 'AccountScreen', component: AccountScreen},
  {name: 'AccountFormScreen', component: AccountFormScreen},
  {name: 'GroupFormScreen', component: GroupFormScreen},
  {name: 'TransferScreen', component: TransferScreen},
  {name: 'ReconcileScreen', component: ReconcileScreen},
  {name: 'NetWorthScreen', component: NetWorthScreen},
  {name: 'RecurringScreen', component: RecurringScreen},
  {name: 'RuleFormScreen', component: RuleFormScreen},
  {name: 'ConfirmRecurringScreen', component: ConfirmRecurringScreen},
  {name: 'AutoBackupScreen', component: AutoBackupScreen},
  {name: 'BackupPassphraseScreen', component: BackupPassphraseScreen},
  {name: 'RangeReportScreen', component: RangeReportScreen},
  {name: 'TrendsScreen', component: TrendsScreen},
];
