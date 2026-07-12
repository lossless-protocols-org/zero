import i18n from './src/i18n';
import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {setNavigationRef} from './src/utils/navigationUtils';
import {Provider} from 'react-redux';
import store, {persistor} from './src/redux/store';
import {PersistGate} from 'redux-persist/integration/react';
import MainStack from './src/navigation/MainStack';
import {LogBox, View, Appearance, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/context/ThemeContext';
import {DialogProvider} from './src/context/DialogContext';
import {AppLockProvider} from './src/context/AppLockContext';
import {SheetProvider} from 'react-native-actions-sheet';
import ErrorBoundary from './src/components/atoms/ErrorBoundary';
import PrimaryText from './src/components/atoms/PrimaryText';
import {initBackend} from './src/backend';
import {getDatabaseError} from './src/watermelondb/database';
import './src/sheets/sheets';
import './src/utils/globalErrorHandler';

const DatabaseErrorFallback = () => {
  const isDark = Appearance.getColorScheme() === 'dark';
  return (
    <View style={[dbStyles.container, {backgroundColor: isDark ? '#000' : '#fff'}]}>
      <PrimaryText size={40} weight="bold" color={isDark ? '#fff' : '#000'}>:(</PrimaryText>
      <PrimaryText size={16} weight="semibold" color={isDark ? '#fff' : '#000'} style={dbStyles.title}>
        {i18n.t('databaseError.title')}
      </PrimaryText>
      <PrimaryText size={13} color="#888" style={dbStyles.subtitle}>
        {i18n.t('databaseError.message')}
      </PrimaryText>
    </View>
  );
};

const dbStyles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  title: {marginTop: 16, textAlign: 'center'},
  subtitle: {marginTop: 8, textAlign: 'center', lineHeight: 20},
});

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}

const App = () => {
  LogBox.ignoreAllLogs();
  const [dbFailed, setDbFailed] = useState(false);

  useEffect(() => {
    initBackend();
    if (getDatabaseError()) {
      setDbFailed(true);
    }
  }, []);

  if (dbFailed) {
    return <DatabaseErrorFallback />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <ThemeProvider>
                <DialogProvider>
                  <AppLockProvider>
                    <SheetProvider>
                      <NavigationContainer ref={setNavigationRef}>
                        <MainStack />
                      </NavigationContainer>
                    </SheetProvider>
                  </AppLockProvider>
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
