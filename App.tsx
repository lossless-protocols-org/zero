import {i18n} from './src/i18n';
import React, {useEffect, useRef, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {setNavigationRef} from './src/platform/navigationUtils';
import {Provider} from 'react-redux';
import {store} from './src/store/store';
import {MainStack} from './src/navigation/MainStack';
import {ActivityIndicator, Appearance, LogBox, Platform, Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/ui/context/ThemeContext';
import {DialogProvider} from './src/ui/context/DialogContext';
import {DialogView} from './src/ui/molecules/DialogView';
import {SheetProvider} from 'react-native-actions-sheet';
import {ErrorBoundary} from './src/ui/atoms/ErrorBoundary';
import {MigrationWarningBanner} from './src/ui/atoms/MigrationWarningBanner';
import {CrashReportPrompt} from './src/ui/atoms/CrashReportPrompt';
import {DataErrorDialog} from './src/ui/atoms/DataErrorDialog';
import {initBackend, isSchemaUpgradePending} from './src/data/startup';
import {appendErrorLog, formatErrorReport} from './src/platform/errorLog';
import './src/navigation/sheets';
import './src/platform/globalErrorHandler';
import {getReportMeta} from './src/platform/reportMeta';
import {startWidgetPublisher} from './src/features/widgets/publish';
import {bootstrapSession} from './src/store/bootstrapSession';
import {startSession} from './src/store/startSession';
import {followSession} from './src/store/followSession';
import {deepLinking} from './src/navigation/linking';
import {usePreference} from './src/ui/hooks/usePreference';
import {isOnboardedPreference} from './src/platform/onboarding';

// Deliberately renders outside every provider (like ErrorBoundary): plain
// Text + Appearance, because ThemeProvider is unavailable when the DB fails.
/**
 * Rendered instead of the app when the database cannot be used. Diagnostics
 * is unreachable in this state and the advice is to reinstall, which wipes
 * the error log — so the error and a share button live here (M3, v2.7.1).
 */
const DatabaseErrorFallback = ({error}: {error: Error | null}) => {
  const isDark = Appearance.getColorScheme() === 'dark';
  const textColor = isDark ? '#ffffff' : '#000000';
  const handleShare = () => {
    const report = formatErrorReport(
      [
        {
          timestamp: new Date().toISOString(),
          message: error?.message ?? 'Database failed to load',
          stack: error?.stack ?? '',
          fatal: true,
        },
      ],
      getReportMeta(),
    );
    Share.share({message: report, title: i18n.t('databaseError.title')}).catch((shareError: unknown) => {
      // The share sheet itself failed; the log entry App wrote is all that remains.
      appendErrorLog(shareError, false);
    });
  };
  return (
    <View style={[dbStyles.container, isDark ? dbStyles.darkBackground : dbStyles.lightBackground]}>
      <Text style={[dbStyles.face, {color: textColor}]}>:(</Text>
      <Text style={[dbStyles.title, {color: textColor}]}>{i18n.t('databaseError.title')}</Text>
      <Text style={dbStyles.subtitle}>{i18n.t('databaseError.message')}</Text>
      {error ? <Text style={dbStyles.detail}>{error.message}</Text> : null}
      <Pressable onPress={handleShare} accessibilityRole="button" style={dbStyles.button}>
        <Text style={[dbStyles.buttonText, {color: textColor}]}>{i18n.t('databaseError.share')}</Text>
      </Pressable>
    </View>
  );
};

/**
 * Shown, once, while a schema change migrates an existing database before
 * the first frame (data/startup.isSchemaUpgradePending): on 10k rows the v4 →
 * v5 step blocks the JS thread for a second or more, which showed as a blank
 * screen. Outside every provider, like DatabaseErrorFallback; the spinner is
 * native, so it turns while SQLite holds the JS thread.
 */
const UpdatingData = () => {
  const isDark = Appearance.getColorScheme() === 'dark';
  return (
    <View
      style={[dbStyles.container, isDark ? dbStyles.darkBackground : dbStyles.lightBackground]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={i18n.t('startup.updating')}>
      <ActivityIndicator color={isDark ? '#ffffff' : '#000000'} />
      <Text style={[dbStyles.title, isDark ? dbStyles.lightText : dbStyles.darkText]}>
        {i18n.t('startup.updating')}
      </Text>
    </View>
  );
};

const dbStyles = StyleSheet.create({
  appRoot: {flex: 1},
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  // Plain colours: the theme provider may be the thing that failed to start.
  darkBackground: {backgroundColor: '#000000'},
  lightBackground: {backgroundColor: '#ffffff'},
  lightText: {color: '#ffffff'},
  darkText: {color: '#000000'},
  face: {fontSize: 40, fontWeight: 'bold'},
  title: {fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center'},
  subtitle: {fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20},
  detail: {
    fontSize: 11,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
  },
  button: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#888',
  },
  buttonText: {fontSize: 13, fontWeight: '600'},
});

// Module scope, once: calling this inside the component re-ran it every render.
LogBox.ignoreAllLogs();

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}

type InitState = 'pending' | 'upgrading' | 'ready' | 'db-failed';

const App = () => {
  // A pending schema change shows "Updating" first and starts once that is on screen.
  const [initState, setInitState] = useState<InitState>(() => (isSchemaUpgradePending() ? 'upgrading' : 'pending'));
  const [upgradeShown, setUpgradeShown] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);
  const canStart = initState === 'pending' || upgradeShown;
  // Set when the start already loaded the session, so the effect below does not load it again.
  const sessionLoadedAtStart = useRef(false);

  // The start blocks the JS thread; it begins two frames after "Updating" is
  // committed, so the view is mounted and drawn first.
  useEffect(() => {
    if (initState !== 'upgrading' || upgradeShown) {
      return undefined;
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setUpgradeShown(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [initState, upgradeShown]);

  useEffect(() => {
    if (!canStart) {
      return undefined;
    }
    let cancelled = false;
    // Await data migrations BEFORE mounting screens, so first fetches can't
    // race them and a late database setup error is actually observed.
    const init = async () => {
      let failure: Error | null;
      try {
        failure = await initBackend();
      } catch (error) {
        // Without this the app would stay on 'pending' and render nothing, forever.
        failure = error instanceof Error ? error : new Error(String(error));
      }
      if (cancelled) {
        return;
      }
      if (failure) {
        appendErrorLog(failure, true);
        setDbError(failure);
        setInitState('db-failed');
        return;
      }
      // What Home draws first, before it mounts (audit 2026-11-08 §8.2).
      if (isOnboardedPreference.get()) {
        await store.dispatch(startSession());
        sessionLoadedAtStart.current = true;
      }
      if (!cancelled) {
        setInitState('ready');
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [canStart]);

  // The home-screen widget follows the data from the moment the database is open.
  useEffect(() => (initState === 'ready' ? startWidgetPublisher() : undefined), [initState]);
  // zero:// links (widget taps) only once onboarding is done: they must not skip it.
  const isOnboarded = usePreference(isOnboardedPreference);
  // The session (user, currency, categories) is (re)loaded every time the app
  // enters the onboarded state: a cold start, the end of onboarding (the
  // currency is chosen AFTER the user exists, so a session started on the
  // name step has none yet), a restore. bootstrapSession is idempotent.
  // The categories and currency follow the database from here on, whoever writes them.
  useEffect(
    () => (initState === 'ready' && isOnboarded ? followSession(store.dispatch) : undefined),
    [initState, isOnboarded],
  );
  useEffect(() => {
    if (initState !== 'ready' || !isOnboarded) {
      return;
    }
    if (sessionLoadedAtStart.current) {
      sessionLoadedAtStart.current = false; // the cold start did it; every later entry loads here
      return;
    }
    void store.dispatch(bootstrapSession());
  }, [initState, isOnboarded]);

  if (initState === 'db-failed') {
    return <DatabaseErrorFallback error={dbError} />;
  }
  if (initState === 'upgrading') {
    return <UpdatingData />;
  }
  if (initState === 'pending') {
    // The native splash/launch screen is still on screen; render nothing.
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <Provider store={store}>
            <ThemeProvider>
              <DialogProvider DialogView={DialogView}>
                <SheetProvider>
                  <NavigationContainer ref={setNavigationRef} linking={{...deepLinking, enabled: isOnboarded}}>
                    <View style={dbStyles.appRoot}>
                      <MigrationWarningBanner />
                      <CrashReportPrompt />
                      <DataErrorDialog />
                      <MainStack />
                    </View>
                  </NavigationContainer>
                </SheetProvider>
              </DialogProvider>
            </ThemeProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default App;
