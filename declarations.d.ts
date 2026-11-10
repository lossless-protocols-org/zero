declare module '*.svg' {
  import React from 'react';
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// React Native globals its typings do not declare; only what the start-up
// marker (src/platform/startupMarker.ts) uses. nativeLoggingHook is the native
// sink console.* writes to (logcat tag ReactNativeJS / os_log), absent in tests;
// `var` so it appears on globalThis.
declare const performance: {now(): number};
declare var nativeLoggingHook: ((message: string, level: number) => void) | undefined;
