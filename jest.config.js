module.exports = {
  // Moved out of the react-native package in RN 0.85.
  preset: '@react-native/jest-preset',
  // Reanimated 4.7 / Worklets 0.13: their native initializers (CSS animation
  // event handler, mutables, …) must resolve to the web/JS variants under jest,
  // otherwise importing the library throws before any test runs. Both packages
  // ship this resolver for exactly that purpose.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js', './jest.setup.js'],
  // One tree for every test, by kind (audit 2026-11-08 §7.2, __tests__/README.md).
  // Only *.test.* files run, so the harness, fixtures and mocks that live
  // beside them are never collected as suites.
  roots: ['<rootDir>/__tests__'],
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  // M21 (v2.7.1): coverage is measured over ALL of src, so a file no test
  // touches counts as 0% instead of being left out (the old 26% was of
  // imported files only). `bun run test:coverage`.
  // Nothing test-related lives under src/ any more, so no exclusions beyond declarations.
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThreshold: {
    // A ratchet (audit 2026-11-08 §7.6): every entry is the measured value
    // rounded down, for all four metrics, so a change that lowers coverage
    // anywhere fails `bun run check` (and CI). Raise an entry in the same
    // change that adds the tests; never lower one. Measured 2026-11-09 after
    // the one-tree move and the §7.6 tests: total lines 65.2 (54.7 on
    // 2026-11-08), branches 49.8 (11 was a floor, not a ratchet).
    //
    // `global` is every file no path below matches: the feature screens and
    // their hooks, ui molecules and sheets (lines 30.7, branches 19.7).
    // Raised 2026-11-09 with the §8/§9 tests: total lines 69.3, branches 52.1.
    global: {lines: 30, statements: 30, branches: 19, functions: 22},
    './src/domain/': {lines: 99, statements: 98, branches: 92, functions: 96},
    './src/constants/': {lines: 100, statements: 100, branches: 100, functions: 100},
    './src/data/backup/': {lines: 98, statements: 98, branches: 82, functions: 100},
    './src/data/': {lines: 93, statements: 93, branches: 77, functions: 92},
    './src/platform/': {lines: 86, statements: 85, branches: 80, functions: 70},
    './src/i18n/': {lines: 100, statements: 93, branches: 94, functions: 87},
    './src/store/': {lines: 88, statements: 88, branches: 63, functions: 89},
    './src/ui/context/': {lines: 95, statements: 95, branches: 72, functions: 95},
    './src/ui/hooks/': {lines: 73, statements: 72, branches: 58, functions: 70},
    './src/ui/atoms/': {lines: 79, statements: 79, branches: 47, functions: 88},
    './src/features/widgets/': {lines: 87, statements: 86, branches: 72, functions: 80},
    './src/features/reports/': {lines: 76, statements: 75, branches: 53, functions: 71},
    './src/navigation/': {lines: 74, statements: 77, branches: 62, functions: 69},
  },
  // __tests__/sqlite/ needs bun's built-in SQLite (bun run test:sqlite); jest skips it.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/sqlite/'],
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
