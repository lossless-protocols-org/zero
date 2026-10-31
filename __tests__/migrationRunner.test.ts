/**
 * M22 (v2.7.1): the data-migration runner's bookkeeping in MMKV — version,
 * retries, the permanent-failure flag and what clears it.
 */
const mockState: {appVersion: string; dbError: Error | null; calls: number[]; failing: Set<number>} = {
  appVersion: '2.7.1',
  dbError: null,
  calls: [],
  failing: new Set<number>(),
};

jest.mock('../src/backend/migrations/registry', () => {
  const step = (version: number) => ({
    version,
    name: `m${version}`,
    up: async () => {
      mockState.calls.push(version);
      if (mockState.failing.has(version)) {
        throw new Error(`m${version} broke`);
      }
    },
  });
  return {DATA_MIGRATIONS: [step(2), step(1)]};
});
jest.mock('../src/utils/getVersion', () => ({getAppVersion: () => mockState.appVersion}));
jest.mock('../src/watermelondb/database', () => ({getDatabaseError: () => mockState.dbError}));

// required after jest.mock so the mocks apply; each cast names the module's own type
const runner = require('../src/backend/migrations/runner') as typeof import('../src/backend/migrations/runner');
const StorageService = (require('../src/utils/storage') as typeof import('../src/utils/storage')).default;
const errorLog = require('../src/utils/errorLog') as typeof import('../src/utils/errorLog');

const KEYS = [
  'data_migration_version',
  'data_migration_retry_count',
  'data_migration_failed',
  'data_migration_failed_app_version',
];

beforeEach(() => {
  KEYS.forEach(key => StorageService.removeItemSync(key));
  errorLog.clearErrorLog();
  Object.assign(mockState, {appVersion: '2.7.1', dbError: null, calls: [], failing: new Set<number>()});
});

it('runs pending migrations in version order and records the version reached', async () => {
  await runner.runMigrations();
  expect(mockState.calls).toEqual([1, 2]);
  expect(StorageService.getNumber('data_migration_version')).toBe(2);
  await runner.runMigrations();
  expect(mockState.calls).toEqual([1, 2]);
});

it('stops at a failing migration, counts the attempt, and keeps the version before it', async () => {
  mockState.failing.add(2);
  await runner.runMigrations();
  expect(StorageService.getNumber('data_migration_version')).toBe(1);
  expect(StorageService.getNumber('data_migration_retry_count')).toBe(1);
  expect(runner.hasMigrationFailed()).toBe(false);
  expect(errorLog.getErrorLog().map(e => e.message)).toEqual(['m2 broke']);
});

it('gives up after three attempts, then only an app update or the user retries it', async () => {
  mockState.failing.add(1);
  await runner.runMigrations();
  await runner.runMigrations();
  await runner.runMigrations();
  expect(runner.hasMigrationFailed()).toBe(true);
  expect(errorLog.getErrorLog().some(e => e.fatal && e.message.includes('permanently failed'))).toBe(true);

  await runner.runMigrations();
  expect(mockState.calls).toEqual([1, 1, 1]); // poisoned for this app version

  mockState.failing.clear();
  mockState.appVersion = '2.7.2';
  await runner.runMigrations();
  expect(runner.hasMigrationFailed()).toBe(false);
  expect(StorageService.getNumber('data_migration_version')).toBe(2);
});

it('lets the user retry from Settings and reports whether it worked', async () => {
  mockState.failing.add(1);
  for (let i = 0; i < 3; i++) {
    await runner.runMigrations();
  }
  expect(await runner.retryMigrations()).toBe(false);
  // Still broken: the warning must survive the next launch, not just this screen.
  expect(runner.hasMigrationFailed()).toBe(true);
  mockState.failing.clear();
  expect(await runner.retryMigrations()).toBe(true);
  expect(runner.hasMigrationFailed()).toBe(false);
});

it('does not spend a retry when the database itself failed to open', async () => {
  mockState.failing.add(1);
  mockState.dbError = new Error('file is not a database');
  await runner.runMigrations();
  expect(StorageService.getNumber('data_migration_retry_count') ?? 0).toBe(0);
});
