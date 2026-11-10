jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/documents',
  DownloadDirectoryPath: '/tmp/downloads',
  // iOS returns NSTemporaryDirectory(), which ends with a slash.
  TemporaryDirectoryPath: '/tmp/temporary/',
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  types: {allFiles: 'public.item'},
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Shared runner-agnostic mocks (also registered by bun-preload.ts for `bun test`)
jest.mock('react-native-localize', () => require('./__tests__/harness/mocks/localize'));
jest.mock('react-native-mmkv', () => require('./__tests__/harness/mocks/mmkv'));

// Every suite gets an in-memory LokiJS WatermelonDB in place of the SQLite
// one: the real schema, migrations, models and service queries, nothing
// native (__tests__/harness/lokiDatabase.ts). Lazy: a suite that never
// imports the database never builds one; each suite file gets its own. A
// suite that tests the real module opts out with
// `jest.unmock('…/src/data/database/database')`; one that needs a broken
// database mocks it itself (its own jest.mock wins over this one).
jest.mock('./src/data/database/database', () => require('./__tests__/harness/lokiDatabase').lokiDatabaseModule());

// SafeAreaProvider renders nothing until the native side reports the window's
// insets, which never happens under jest; the library's own mock gives it a
// frame and zero insets, so whole screens (App) render.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
