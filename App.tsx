import i18n from './src/i18n';
import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {setNavigationRef} from './src/utils/navigationUtils';
import {Provider} from 'react-redux';
import store from './src/redux/store';
import MainStack from './src/navigation/MainStack';
import {LogBox, View, Text, Appearance, StyleSheet, Platform, Pressable, Share} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/context/ThemeContext';
import {DialogProvider} from './src/context/DialogContext';
import {DialogView} from './src/components/molecules/DialogView';
import {SheetProvider} from 'react-native-actions-sheet';
import ErrorBoundary from './src/components/atoms/ErrorBoundary';
import MigrationWarningBanner from './src/components/atoms/MigrationWarningBanner';
import CrashReportPrompt from './src/components/atoms/CrashReportPrompt';
import {DataErrorDialog} from './src/components/atoms/DataErrorDialog';
import {initBackend} from './src/backend';
import {appendErrorLog, formatErrorReport} from './src/utils/errorLog';
import './src/sheets/sheets';
import './src/utils/globalErrorHandler';
import {getReportMeta} from './src/utils/reportMeta';

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

const dbStyles = StyleSheet.create({
  appRoot: {flex: 1},
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  // Plain colours: the theme provider may be the thing that failed to start.
  darkBackground: {backgroundColor: '#000000'},
  lightBackground: {backgroundColor: '#ffffff'},
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

type InitState = 'pending' | 'ready' | 'db-failed';

const App = () => {
  const [initState, setInitState] = useState<InitState>('pending');
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
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
      setInitState('ready');
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  if (initState === 'db-failed') {
    return <DatabaseErrorFallback error={dbError} />;
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
                  <NavigationContainer ref={setNavigationRef}>
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
