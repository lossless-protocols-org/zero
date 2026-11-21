/**
 * The dependency rule for src/ (M9, v2.7.1; feature layout, audit 2026-11-08
 * §4.4–4.5; dependency-cruiser since §7.7, replacing the hand-written
 * scripts/check-layers.mjs). Lowest to highest:
 *
 *   domain, constants   pure rules and types: money units, day keys, period/budget/debt maths
 *   platform            the device: MMKV, preferences, locale and formatting, error log, navigation ref
 *   i18n                strings and validation messages
 *   data, native        the database, its services, data migrations, backup; the TurboModule specs
 *   pro                 who is paying (3.0): the entitlement decision, capabilities, the Free projection
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
 *   - src/native has one gateway per module and no other importer: features/widgets/bridge.ts (the
 *     widget TurboModules), pro/billing.ts (the store), pro/reminders.ts (reminders) and
 *     data/backup/vault.ts (the encrypted backup, P10) and pro/reportPdf.ts (PDF reports, P12);
 *   - a feature never imports another feature: what two features share moves down a layer;
 *   - inside a feature, lib < hooks < components < sheets < screens (quickAdd/ is a root, screen level);
 *   - no import cycles.
 * Type-only imports are exempt from every rule but one: the compiler erases
 * them, so they create no runtime edge, init-order cycle or bundle coupling.
 *
 * The 3.0 laws (handbook/blueprint/ZERO_3.0_ENTITLEMENT.md) that are import rules:
 *   - L1, tier-blind data: domain, constants, data and native import nothing from src/pro or
 *     from any layer above it, not even a type. Who is paying changes what is shown and what
 *     runs, never a stored row, so the layers that own rows cannot ask, directly or through a
 *     type some higher layer re-exports. (This is the one rule type-only imports do not escape.)
 *   - L8, gated features: a feature in PRO_FEATURE_DIRS is imported only by
 *     navigation/ProStack.tsx, and ProStack only by navigation/HomeStack.tsx, which mounts it
 *     only for Pro. No free screen can render one.
 *   - src/pro decides and nothing else: no React and no i18next (its hooks live in ui/hooks).
 *   - domain/freeTier (what Free includes) is read only above the data layer, for the same
 *     reason as L1. One 2.8 data module still reads it and is listed in the rule as debt; 3.0 removes it
 *     (handbook/blueprint/ZERO_3.0_PLAN.md, P9; the import planner's was removed in P7).
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
  {name: 'pro', rank: 4, path: '^src/pro/'},
  {name: 'store', rank: 5, path: '^src/store/'},
  {name: 'ui', rank: 6, path: '^src/ui/(hooks/|context/|[^/]+$)'},
  {name: 'ui/atoms', rank: 7, path: '^src/ui/atoms/'},
  {name: 'ui/molecules', rank: 8, path: '^src/ui/molecules/'},
  {name: 'ui/sheets', rank: 9, path: '^src/ui/sheets/'},
  {name: 'features', rank: 10, path: '^src/features/'},
  {name: 'navigation', rank: 11, path: '^src/navigation/'},
];

/**
 * The features that exist only for Pro (L8). A phase adds its folder here in the commit that
 * creates it. features/pro is NOT one: the upgrade sheet, the notices and the Settings rows
 * are what a free user sees.
 */
const PRO_FEATURE_DIRS = ['accounts', 'recurring', 'backup'];
/**
 * A whole Pro feature folder, or a `pro/` folder inside a free feature: the Pro screens of a
 * feature a free user also has (Reports' range and trends, P11 and P12) live there.
 */
const PRO_FEATURES = `^src/features/((${PRO_FEATURE_DIRS.join('|')})/|[^/]+/pro/)`;
/** The one module that imports them, mounted only when the entitlement says Pro… */
const PRO_STACK = '^src/navigation/ProStack\\.tsx$';
/** …and the one module that mounts it. */
const PRO_STACK_MOUNT = '^src/navigation/HomeStack\\.tsx$';
const ANY_LAYER = LAYERS.map(l => `(${l.path})`).join('|');

/** Parts of one feature in order; a file at the feature's root is its lib. */
const FEATURE_PARTS = [
  {name: 'lib', path: '[^/]+$'},
  {name: 'hooks', path: 'hooks/'},
  {name: 'components', path: 'components/'},
  {name: 'sheets', path: 'sheets/'},
  {name: 'screens', path: '(screens|quickAdd|pro)/'},
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
      comment:
        'each native module has one gateway: features/widgets/bridge.ts for the widget modules, pro/billing.ts for the store, pro/reminders.ts for reminders, data/backup/vault.ts for the encrypted backup, pro/reportPdf.ts for PDF reports',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/(features/widgets/bridge|pro/billing|pro/reminders|pro/reportPdf|data/backup/vault)\\.ts$',
      },
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
      name: 'tier-blind-data',
      comment:
        'L1: domain, data and native import nothing from src/pro or any layer above it, not even a type: stored rows never depend on who pays, and a type re-exported through a higher layer is still asking',
      severity: 'error',
      from: {path: '^src/(domain|constants|data|native)/'},
      // No RUNTIME here on purpose: this is the one rule a type-only import does not escape.
      to: {path: '^src/(pro|store|ui|features|navigation)/'},
    },
    {
      name: 'free-limits-not-in-data',
      comment:
        'L1: what Free includes (a domain/freeTier module, when one exists) is read only above the data layer. P9 removed the last one, the income-category limit in categoryService: the Categories screen decides it now. No new one, and no re-export from domain',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/(pro|store|ui|features|navigation)/|^src/domain/freeTier(\\.ts$|/)',
      },
      to: {path: '^src/domain/freeTier(\\.ts$|/)'},
    },
    {
      name: 'pro-decides-only',
      comment: 'src/pro has no React and no i18next: it decides; hooks over it live in ui/hooks',
      severity: 'error',
      from: {path: '^src/pro/'},
      to: {...RUNTIME, path: pkgs(REACT_AND_I18N)},
    },
    {
      name: 'pro-features-behind-pro-stack',
      comment: 'L8: a Pro-only feature is imported only by navigation/ProStack.tsx (add new ones to PRO_FEATURE_DIRS)',
      severity: 'error',
      from: {path: '^src/', pathNot: `${PRO_FEATURES}|${PRO_STACK}`},
      to: {...RUNTIME, path: PRO_FEATURES},
    },
    {
      name: 'pro-stack-single-mount',
      comment: 'L8: only HomeStack mounts ProStack, so there is one place that decides whether Pro screens exist',
      severity: 'error',
      from: {path: '^src/', pathNot: PRO_STACK_MOUNT},
      to: {...RUNTIME, path: PRO_STACK},
    },
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
