/**
 * Flat config (ESLint 9+). Replaces the legacy .eslintrc.js — ESLint 10
 * dropped eslintrc support entirely, and ESLint is pinned to ^9 because
 * eslint-plugin-react-hooks / eslint-plugin-react / @babel/eslint-parser
 * all cap their peer range at 9.
 */
const reactNativeConfig = require('@react-native/eslint-config/flat');

// The RN config ships Flow lint rules (eslint-plugin-ft-flow) for **/*.js.
// This codebase is TypeScript-only, and the pinned ft-flow@2 calls
// context.getAllComments(), removed in ESLint 9 — it crashes the whole run.
// Dropping the block is correct here rather than force-resolving ft-flow@3.
const withoutFlowRules = reactNativeConfig.filter(entry => !entry.plugins?.['ft-flow']);

module.exports = [
  {
    ignores: ['references/**', 'android/**', 'ios/**', 'coverage/**', 'vendor/**', 'node_modules/**'],
  },
  ...withoutFlowRules,
  {
    // M7 (v2.7.1): a promise nobody awaits must be handled or explicitly
    // ignored. `void` is the ignore marker (thunk dispatches, sheet calls —
    // the store's rejection middleware or the promise's own contract covers
    // them), so `no-void` allows it as a statement; everything else goes
    // through `logRejection`.
    files: ['src/**/*.{ts,tsx}', 'App.tsx', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {parserOptions: {projectService: true, tsconfigRootDir: __dirname}},
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', {ignoreVoid: true}],
      '@typescript-eslint/no-misused-promises': 'error',
      // M20 (v2.7.1): `any` reached 0; keep it there. Type the value, or take `unknown` and narrow.
      '@typescript-eslint/no-explicit-any': 'error',
      // The TS version honours noPropertyAccessFromIndexSignature; the core rule does not.
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'warn',
      'no-void': ['warn', {allowAsStatement: true}],
    },
  },
  {
    // Test setup/preload files run in the test runner, not the app.
    files: ['jest.setup.js', 'jest.config.js', 'bun-preload.ts', 'src/testing/**'],
    languageOptions: {
      globals: {jest: 'readonly', require: 'readonly', module: 'writable'},
    },
  },
];
