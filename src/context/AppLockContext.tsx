import React, {createContext, useContext, useState, useEffect, useCallback, type ReactNode} from 'react';
import {AppState, Modal} from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';
import StorageService from '../utils/asyncStorageService';
import LockScreen from '../components/atoms/LockScreen';
import {useTranslation} from 'react-i18next';
import {useSelector} from 'react-redux';
import {selectIsOnboarded} from '../redux/slice/isOnboardedSlice';

interface AppLockContextType {
  isAppLockEnabled: boolean;
  isBiometricAvailable: boolean;
  toggleAppLock: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

interface AppLockProviderProps {
  children: ReactNode;
}

const rnBiometrics = new ReactNativeBiometrics();
const APP_LOCK_ENABLED_KEY = 'appLockEnabled';

export const AppLockProvider: React.FC<AppLockProviderProps> = ({children}) => {
  const {t} = useTranslation();
  const isOnboarded = useSelector(selectIsOnboarded);
  
  const [isAppLockEnabled, setIsAppLockEnabled] = useState<boolean>(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [appState, setAppState] = useState(AppState.currentState);

  // Initialize
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const {available} = await rnBiometrics.isSensorAvailable();
        setIsBiometricAvailable(available);
        
        // Read preference
        const enabled = StorageService.getBoolean(APP_LOCK_ENABLED_KEY);
        
        if (enabled) {
          if (available) {
            setIsAppLockEnabled(true);
            setIsLocked(true); // Lock on startup if enabled
          } else {
            // Graceful fallback: sensor no longer available, disable lock
            StorageService.setBoolean(APP_LOCK_ENABLED_KEY, false);
            setIsAppLockEnabled(false);
            setIsLocked(false);
          }
        }
      } catch (error) {
        if (__DEV__) console.error('Biometrics check error:', error);
      }
    };
    
    checkAvailability();
  }, []);

  const authenticate = useCallback(async () => {
    if (!isBiometricAvailable) return false;
    
    try {
      const {success} = await rnBiometrics.simplePrompt({
        promptMessage: t('settings.appLockPrompt') || 'Unlock Zero',
      });
      
      if (success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (error) {
      if (__DEV__) console.error('Authentication error:', error);
      return false;
    }
  }, [isBiometricAvailable, t]);

  // Handle App State changes (background -> foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        if (isAppLockEnabled && isOnboarded) {
          setIsLocked(true);
        }
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, isAppLockEnabled, isOnboarded]);

  // Auto-authenticate when locked screen appears
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isLocked && isOnboarded) {
      // Small timeout to ensure UI renders before native prompt
      timer = setTimeout(() => {
        void authenticate();
      }, 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLocked, isOnboarded, authenticate]);

  const toggleAppLock = useCallback(async () => {
    if (!isBiometricAvailable) return false;

    if (isAppLockEnabled) {
      // Disabling requires authentication
      const success = await authenticate();
      if (success) {
        StorageService.setBoolean(APP_LOCK_ENABLED_KEY, false);
        setIsAppLockEnabled(false);
      }
      return !success; // return true if still enabled
    } else {
      // Enabling requires authentication to prove it works
      const success = await authenticate();
      if (success) {
        StorageService.setBoolean(APP_LOCK_ENABLED_KEY, true);
        setIsAppLockEnabled(true);
      }
      return success; // return true if successfully enabled
    }
  }, [isAppLockEnabled, isBiometricAvailable, authenticate]);

  const value = {
    isAppLockEnabled,
    isBiometricAvailable,
    toggleAppLock,
  };

  // Only show lock screen if user is onboarded
  const showLockScreen = isLocked && isOnboarded;

  return (
    <AppLockContext.Provider value={value}>
      {children}
      <Modal visible={showLockScreen} animationType="fade" transparent={false} statusBarTranslucent>
        <LockScreen onAuthenticate={authenticate} />
      </Modal>
    </AppLockContext.Provider>
  );
};

export const useAppLock = (): AppLockContextType => {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};

export default AppLockContext;
