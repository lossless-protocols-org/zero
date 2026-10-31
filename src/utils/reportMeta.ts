import {Platform} from 'react-native';
import {getAppVersion} from './getVersion';
import type {ReportMeta} from './errorLog';

/**
 * The device facts every error report carries (app, crash prompt,
 * Diagnostics), from one place. Brand, model and release are Android-only;
 * `Platform.OS` narrows the constants to them, so no cast is needed (M20).
 */
export const getReportMeta = (): ReportMeta => {
  const base = {appVersion: getAppVersion(), os: Platform.OS, osVersion: String(Platform.Version)};
  if (Platform.OS !== 'android') {
    return base;
  }
  const {Release, Brand, Model} = Platform.constants;
  return {...base, osVersion: Release || base.osVersion, brand: Brand, model: Model};
};
