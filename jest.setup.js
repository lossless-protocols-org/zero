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
jest.mock('react-native-localize', () => require('./src/testing/localizeMock'));
jest.mock('react-native-mmkv', () => require('./src/testing/mmkvMock'));
