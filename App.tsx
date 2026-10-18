import i18n from './src/i18n';
import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {setNavigationRef} from './src/utils/navigationUtils';
import {Provider} from 'react-redux';
import store, {persistor} from './src/redux/store';
import {PersistGate} from 'redux-persist/integration/react';
import MainStack from './src/navigation/MainStack';
import {LogBox, View, Text, Appearance, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/context/ThemeContext';
import {DialogProvider} from './src/context/DialogContext';
import {SheetProvider} from 'react-native-actions-sheet';
import ErrorBoundary from './src/components/atoms/ErrorBoundary';
import MigrationWarningBanner from './src/components/atoms/MigrationWarningBanner';
import CrashReportPrompt from './src/components/atoms/CrashReportPrompt';
import {initBackend} from './src/backend';
import {getDatabaseError} from './src/watermelondb/database';
import {appendErrorLog} from './src/utils/errorLog';
import './src/sheets/sheets';
import './src/utils/globalErrorHandler';

// Deliberately renders outside every provider (like ErrorBoundary): plain
// Text + Appearance, because ThemeProvider is unavailable when the DB fails.
const DatabaseErrorFallback = () => {
  const isDark = Appearance.getColorScheme() === 'dark';
  const textColor = isDark ? '#fff' : '#000';
  return (
    <View style={[dbStyles.container, {backgroundColor: isDark ? '#000' : '#fff'}]}>
      <Text style={[dbStyles.face, {color: textColor}]}>:(</Text>
      <Text style={[dbStyles.title, {color: textColor}]}>
        {i18n.t('databaseError.title')}
      </Text>
      <Text style={dbStyles.subtitle}>{i18n.t('databaseError.message')}</Text>
    </View>
  );
};

const dbStyles = StyleSheet.create({
  appRoot: {flex: 1},
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  face: {fontSize: 40, fontWeight: 'bold'},
  title: {fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center'},
  subtitle: {fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20},
});

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}

type InitState = 'pending' | 'ready' | 'db-failed';

const App = () => {
  LogBox.ignoreAllLogs();
  const [initState, setInitState] = useState<InitState>('pending');

  useEffect(() => {
    let cancelled = false;
    // Await data migrations BEFORE mounting screens, so first fetches can't
    // race them and a late database setup error is actually observed.
    const init = async () => {
      await initBackend();
      if (cancelled) {
        return;
      }
      const dbError = getDatabaseError();
      if (dbError) {
        appendErrorLog(dbError, true);
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
    return <DatabaseErrorFallback />;
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
            <PersistGate loading={null} persistor={persistor}>
              <ThemeProvider>
                <DialogProvider>
                  <SheetProvider>
                    <NavigationContainer ref={setNavigationRef}>
                      <View style={dbStyles.appRoot}>
                        <MigrationWarningBanner />
                        <CrashReportPrompt />
                        <MainStack />
                      </View>
                    </NavigationContainer>
                  </SheetProvider>
                </DialogProvider>
              </ThemeProvider>
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default App;
