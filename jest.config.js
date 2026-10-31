module.exports = {
  // Moved out of the react-native package in RN 0.85.
  preset: '@react-native/jest-preset',
  // Reanimated 4.7 / Worklets 0.13: their native initializers (CSS animation
  // event handler, mutables, …) must resolve to the web/JS variants under jest,
  // otherwise importing the library throws before any test runs. Both packages
  // ship this resolver for exactly that purpose.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js', './jest.setup.js'],
  // M21 (v2.7.1): coverage is measured over ALL of src, so a file no test
  // touches counts as 0% instead of being left out (the old 26% was of
  // imported files only). Thresholds are a ratchet: set just under what is
  // measured, raised as tests land, never lowered. `bun run test:coverage`.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/testing/**', '!src/**/*.d.ts'],
  coverageThreshold: {
    // `global` is every file NOT matched by a path below: the UI layers
    // (components, screens, sheets, hooks, …). Measured 2026-10-31: lines
    // 24.9, statements 24.2, branches 11.4, functions 15.6. (All of src: 47.2 lines.)
    global: {lines: 24, statements: 23, branches: 11, functions: 15},
    // measured (lines): backend 99.2 (with the migration-script tests), utils 87.6,
    // watermelondb 73.2, redux 65.8
    './src/backend/': {lines: 98},
    './src/utils/': {lines: 86},
    './src/watermelondb/': {lines: 72},
    './src/redux/': {lines: 64},
  },
  // *.bun.test.ts suites need bun's built-in SQLite (see bunfig.toml); jest skips them.
  testPathIgnorePatterns: ['/node_modules/', '/references/', '\\.bun\\.test\\.ts$'],
  moduleNameMapper: {
    // lucide 1.x resolves to an .mjs bundle under the RN preset's conditions,
    // which jest cannot parse. Point tests at its CommonJS build instead.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      '@react-native-community|' +
      'react-native|' +
      '@react-navigation|' +
      '@nozbe/watermelondb|' +
      'react-native-actions-sheet|' +
      'react-native-reanimated|' +
      'react-native-worklets|' +
      'react-native-gesture-handler|' +
      'react-native-safe-area-context|' +
      '@shopify/flash-list|' +
      'react-native-svg|' +
      'lucide-react-native|' +
      'react-native-mmkv|' +
      'react-native-fs|' +
      '@react-native-documents|' +
      'react-redux|' +
      'immer|' +
      'reselect|' +
      'nanoid' +
      ')/)',
  ],
};
