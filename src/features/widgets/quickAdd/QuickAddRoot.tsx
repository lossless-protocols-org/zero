import React, {useEffect, useState} from 'react';
// First, as in App.tsx: this root can start on its own (a cold launch from the
// widget or a launcher shortcut) and must not depend on App having been loaded.
// Release bundles evaluate imports lazily (Metro inline requires), so the
// i18next set-up App imports never ran here and the sheet showed raw keys
// (found on the Moto, 2026-11-09). A side-effect import is evaluated eagerly.
import '../../../i18n';
import {Provider} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {store} from '../../../store/store';
import {bootstrapSession} from '../../../store/bootstrapSession';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {ThemeProvider} from '../../../ui/context/ThemeContext';
import {ErrorBoundary} from '../../../ui/atoms/ErrorBoundary';
import {initBackend} from '../../../data/startup';
import {appendErrorLog} from '../../../platform/errorLog';
import {isOnboardedPreference} from '../../../platform/onboarding';
import {closeQuickAdd, fadeQuickAddScrim, openInApp} from '../bridge';
import type {QuickAddHost} from './host';
import {QuickAddSheet} from './QuickAddSheet';
import type {QuickAddKind} from './useQuickAdd';

/** Android: the sheet's own window over the home screen (QuickAddActivity). */
const windowHost: QuickAddHost = {
  close: closeQuickAdd,
  openFull: kind => openInApp(kind === 'income' ? 'zero://money/add' : 'zero://add'),
  dimLeaving: fadeQuickAddScrim,
  drawsScrim: false,
};

/** Launch options the native QuickAddActivity passes (strings, possibly absent). */
interface QuickAddRootProps {
  kind?: string;
  categoryId?: string;
  /** "Add again" from the widget: the entry's amount ("20") and title. */
  amount?: string;
  title?: string;
}

/**
 * The quick-add sheet's own React root (2.8), registered as `zeroQuickAdd`
 * and hosted by the native QuickAddActivity over the home screen. Same JS
 * runtime, store and database as the app; it opens the backend through the
 * shared once-only start, starts the session if the app has not
 * (bootstrapSession), and never renders the app's navigation.
 */
export const QuickAddRoot: React.FC<QuickAddRootProps> = ({kind, categoryId, amount, title}) => {
  const [state, setState] = useState<'pending' | 'ready' | 'failed'>('pending');

  useEffect(() => {
    let cancelled = false;
    initBackend()
      .then(failure => {
        if (cancelled) {
          return;
        }
        if (failure) {
          // The full app shows the database error and its share button; here, just step aside.
          appendErrorLog(failure, true);
          setState('failed');
          closeQuickAdd();
          return;
        }
        // The sheet can be the first thing to run in this process: start the
        // session the app would have (a no-op when the app already did).
        if (!selectUserId(store.getState())) {
          void store.dispatch(bootstrapSession());
        }
        setState('ready');
      })
      .catch((error: unknown) => {
        appendErrorLog(error, true);
        closeQuickAdd();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== 'ready') {
    return null;
  }
  const sheetKind: QuickAddKind = kind === 'income' ? 'income' : 'expense';
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <QuickAddSheet
              kind={sheetKind}
              categoryId={categoryId ?? ''}
              ready={isOnboardedPreference.get()}
              host={windowHost}
              prefill={amount ? {amount, text: title ?? ''} : undefined}
            />
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};
