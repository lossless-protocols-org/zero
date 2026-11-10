/**
 * The dependency rule for src/ (M9, v2.7.1; feature layout, audit 2026-11-08
 * §4.4–4.5; dependency-cruiser since §7.7, replacing the hand-written
 * scripts/check-layers.mjs). Lowest to highest:
 *
 *   domain, constants   pure rules and types: money units, day keys, period/budget/debt maths
 *   platform            the device: MMKV, preferences, locale and formatting, error log, navigation ref
 *   i18n                strings and validation messages
 *   data, native        the database, its services, data migrations, backup; the TurboModule specs
 *   store               Redux: slices, session start, middleware
 *   ui                  shared view code: hooks, contexts and helpers → atoms → molecules → sheets
 *   features/<name>     one product area each: lib → hooks → components → sheets → screens
 *   navigation          the app shell: stacks, links, the sheet registry
 *
 * A module may import from its own layer or a lower one. On top of that:
 *   - domain stays pure: no React, React Native, i18n, database, navigation or state packages;
 *   - platform has no React and no i18next (it sits below i18n);
 *   - components (ui atoms/molecules and features' components) reach the store and the data
 *     layer only through hooks;
 *   - only features/widgets/bridge.ts talks to src/native (the widget TurboModule);
 *   - a feature never imports another feature: what two features share moves down a layer;
 *   - inside a feature, lib < hooks < components < sheets < screens (quickAdd/ is a root, screen level);
 *   - no import cycles.
 * Type-only imports are exempt from every rule: the compiler erases them, so
 * they create no runtime edge, init-order cycle or bundle coupling.
 *
 * Run: `bun run check:layers`. __tests__/arch/layers.test.ts runs it on src/
 * and on a fixture tree that breaks every rule once, so a rule that stops
 * firing fails too.
 */
const fs = require('node:fs');

/** Rank, then the paths in that rank. Longest match wins: ui/atoms is not ui. */
const LAYERS = [
  {name: 'domain', rank: 0, path: '^src/(domain|constants)/'},
  {name: 'platform', rank: 1, path: '^src/platform/'},
  {name: 'i18n', rank: 2, path: '^src/i18n/'},
  {name: 'data', rank: 3, path: '^src/(data|native)/'},
  {name: 'store', rank: 4, path: '^src/store/'},
  {name: 'ui', rank: 5, path: '^src/ui/(hooks/|context/|[^/]+$)'},
  {name: 'ui/atoms', rank: 6, path: '^src/ui/atoms/'},
  {name: 'ui/molecules', rank: 7, path: '^src/ui/molecules/'},
  {name: 'ui/sheets', rank: 8, path: '^src/ui/sheets/'},
  {name: 'features', rank: 9, path: '^src/features/'},
  {name: 'navigation', rank: 10, path: '^src/navigation/'},
];
const ANY_LAYER = LAYERS.map(l => `(${l.path})`).join('|');

/** Parts of one feature in order; a file at the feature's root is its lib. */
const FEATURE_PARTS = [
  {name: 'lib', path: '[^/]+$'},
  {name: 'hooks', path: 'hooks/'},
  {name: 'components', path: 'components/'},
  {name: 'sheets', path: 'sheets/'},
  {name: 'screens', path: '(screens|quickAdd)/'},
];

const pkgs = names => `^(node_modules/)?(${names.join('|')})(/|$)`;
const REACT_AND_I18N = ['react', 'i18next', 'react-i18next', 'react-redux', '@reduxjs/[^/]+'];
const DOMAIN_FORBIDDEN = [
  ...REACT_AND_I18N,
  'react-native',
  'react-native-[^/]+',
  '@react-native[^/]*/[^/]+',
  '@nozbe/[^/]+',
  '@react-navigation/[^/]+',
];

/** Rules apply to runtime edges only. */
const RUNTIME = {dependencyTypesNot: ['type-only']};

const upward = LAYERS.map(from => ({
  name: `layer-${from.name.replace('/', '-')}`,
  comment: `${from.name} may import only its own layer or a lower one`,
  severity: 'error',
  from: {path: from.path},
  to: {
    ...RUNTIME,
    path: LAYERS.filter(to => to.rank > from.rank)
      .map(to => `(${to.path})`)
      .join('|'),
  },
})).filter(rule => rule.to.path !== '');

const featureOrder = FEATURE_PARTS.slice(0, -1).map((part, i) => ({
  name: `feature-order-${part.name}`,
  comment: `inside a feature, ${part.name} may not import ${FEATURE_PARTS.slice(i + 1)
    .map(p => p.name)
    .join(', ')}`,
  severity: 'error',
  from: {path: `^src/features/([^/]+)/${part.path}`},
  to: {
    ...RUNTIME,
    path: `^src/features/$1/(${FEATURE_PARTS.slice(i + 1)
      .map(p => p.path)
      .join('|')})`,
  },
}));

module.exports = {
  forbidden: [
    ...upward,
    {
      name: 'outside-every-layer',
      comment: 'every module under src/ belongs to a layer (add the folder to LAYERS)',
      severity: 'error',
      from: {path: '^src/', pathNot: ANY_LAYER},
      to: {},
    },
    {
      name: 'domain-pure',
      comment: 'domain stays pure: no React, React Native, i18n, database, navigation or state packages',
      severity: 'error',
      from: {path: LAYERS[0].path},
      to: {...RUNTIME, path: pkgs(DOMAIN_FORBIDDEN)},
    },
    {
      name: 'platform-no-react',
      comment: 'platform has no React and no i18next (it sits below i18n)',
      severity: 'error',
      from: {path: '^src/platform/'},
      to: {...RUNTIME, path: pkgs(REACT_AND_I18N)},
    },
    {
      name: 'components-through-hooks',
      comment: 'components reach the store and the data layer through hooks',
      severity: 'error',
      from: {path: '^src/(ui/atoms|ui/molecules|features/[^/]+/components)/'},
      to: {...RUNTIME, path: '^src/(store|data)/'},
    },
    {
      name: 'native-gateway',
      comment: 'only features/widgets/bridge.ts talks to the widget module',
      severity: 'error',
      from: {path: '^src/', pathNot: '^src/features/widgets/bridge\\.ts$'},
      to: {...RUNTIME, path: '^src/native/'},
    },
    {
      name: 'no-cross-feature',
      comment: 'a feature never imports another feature: move what both need down a layer',
      severity: 'error',
      from: {path: '^src/features/([^/]+)/'},
      to: {...RUNTIME, path: '^src/features/', pathNot: '^src/features/$1/'},
    },
    ...featureOrder,
    {
      name: 'no-circular',
      comment: 'no import cycles (an init-order cycle is a crash waiting for the right import order)',
      severity: 'error',
      from: {path: '^src/'},
      to: {circular: true, viaOnly: RUNTIME},
    },
  ],
  options: {
    doNotFollow: {path: 'node_modules'},
    // A package's path stays node_modules/<name>/… even when it is a symlink
    // (the rule test links the repository's node_modules into its fixture).
    preserveSymlinks: true,
    includeOnly: '^(src/|node_modules/)',
    // Type-only imports are seen (and exempted) instead of being invisible.
    tsPreCompilationDeps: true,
    ...(fs.existsSync('tsconfig.json') ? {tsConfig: {fileName: 'tsconfig.json'}} : {}),
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['react-native', 'require', 'import', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {text: {highlightFocused: true}},
  },
};
