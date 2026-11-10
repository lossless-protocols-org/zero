import 'react-native-get-random-values';

import {AppRegistry, Platform} from 'react-native';
import App from './App';
import {QuickAddRoot} from './src/features/widgets/quickAdd/QuickAddRoot';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
// The quick-add sheet's own window over the home screen (Android
// QuickAddActivity, 2.8). iOS shows the sheet as a screen inside the app, so
// it registers no second root (audit 2026-11-08 §6.2).
if (Platform.OS === 'android') {
  AppRegistry.registerComponent('zeroQuickAdd', () => QuickAddRoot);
}
