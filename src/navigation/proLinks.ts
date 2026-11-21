import {getStateFromPath as defaultGetStateFromPath} from '@react-navigation/native';
import {getAppliedPro} from '../pro/proGate';

/**
 * The routes that exist only for Pro (3.0 law L8), by name. A phase that adds
 * a Pro screen adds its name here and its screen to `ProStack.tsx`, in the
 * same commit. Kept apart from ProStack so the link handler can know the
 * names without importing a single Pro screen.
 * @internal Read through the functions below; tests check it matches PRO_SCREENS.
 */
export const PRO_ROUTES: readonly string[] = [
  'AccountsScreen',
  'AccountScreen',
  'AccountFormScreen',
  'GroupFormScreen',
  'TransferScreen',
  'ReconcileScreen',
  'NetWorthScreen',
  'RecurringScreen',
  'RuleFormScreen',
  'ConfirmRecurringScreen',
  'AutoBackupScreen',
  'BackupPassphraseScreen',
  'RangeReportScreen',
  'TrendsScreen',
];

type GetStateFromPath = typeof defaultGetStateFromPath;

/** The innermost route a navigation state names. */
const leafRouteName = (state: ReturnType<GetStateFromPath>): string | undefined => {
  const route = state?.routes[state.index ?? state.routes.length - 1];
  // A partial state nests the next navigator's state under `state`.
  return route?.state ? leafRouteName(route.state as ReturnType<GetStateFromPath>) : route?.name;
};

/**
 * A link to a Pro screen, opened without Pro, is dropped: the screen is not
 * mounted, so there is nothing to open, and the app starts or stays where any
 * unrecognised link leaves it (Home on a cold start). With Pro it is an
 * ordinary link.
 */
export const proAwareGetStateFromPath =
  (proRoutes: readonly string[] = PRO_ROUTES, isProNow: () => boolean = getAppliedPro): GetStateFromPath =>
  (path, options) => {
    const state = defaultGetStateFromPath(path, options);
    const leaf = leafRouteName(state);
    return leaf !== undefined && proRoutes.includes(leaf) && !isProNow() ? undefined : state;
  };

/** Whether a route is a Pro screen, for the gate that holds a downgrade while one is open. */
export const isProRoute = (name: string | undefined, proRoutes: readonly string[] = PRO_ROUTES): boolean =>
  name !== undefined && proRoutes.includes(name);
