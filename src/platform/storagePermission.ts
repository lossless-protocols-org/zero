import {appendErrorLog} from './errorLog';
import {PermissionsAndroid, Platform} from 'react-native';

export const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    const currentApiLevel = Platform.Version;

    if (currentApiLevel > 32) {
      return true;
    }

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ];

      // Single request only — re-prompting immediately after a denial is
      // hostile UX, and NEVER_ASK_AGAIN can't be recovered here anyway
      // (callers show an "open settings" dialog on false).
      const granted = await PermissionsAndroid.requestMultiple(permissions);

      return (
        granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      // A thrown request (no activity, OEM restriction) is not a denial; the
      // caller still shows its "open settings" path, but the cause is kept.
      appendErrorLog(err, false);
      return false;
    }
  } else {
    return true;
  }
};
