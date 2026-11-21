/**
 * The pre-3.0 flag is decided when the database has opened (3.0 plan P3). An
 * install that updates from 2.7.1 or older straight past 2.8 has data but no
 * flag; recording the version it updated TO would make years of use look like
 * a new install, and the thank-you price would pass it by. A start that
 * cannot open the database decides nothing.
 */
const KEY = 'firstSeenAppVersion';

interface Loaded {
  startup: typeof import('../../src/data/startup');
  storage: typeof import('../../src/platform/storage');
  users: typeof import('../../src/data/services/userService');
  version: typeof import('../../src/platform/getVersion');
}

/** The modules as a cold start finds them: an empty database and empty preferences. */
const coldStart = (): Loaded => {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    // Each `require` returns the module's own type.
    loaded = {
      startup: require('../../src/data/startup') as Loaded['startup'],
      storage: require('../../src/platform/storage') as Loaded['storage'],
      users: require('../../src/data/services/userService') as Loaded['users'],
      version: require('../../src/platform/getVersion') as Loaded['version'],
    };
  });
  return loaded as Loaded; // isolateModules runs synchronously
};

afterEach(() => {
  // Back to the in-memory database every suite gets (jest.setup.js), after the test that breaks it.
  jest.doMock('../../src/data/database/database', () =>
    // The harness module's own type.
    (require('../harness/lokiDatabase') as typeof import('../harness/lokiDatabase')).lokiDatabaseModule(),
  );
});

it('records the running version for a new install', async () => {
  const app = coldStart();
  expect(await app.startup.initBackend()).toBeNull();
  expect(app.storage.StorageService.getItemSync(KEY)).toBe(app.version.getAppVersion());
});

it('records a pre-2.8 version for an install that already holds a user and has no flag', async () => {
  const app = coldStart();
  await app.users.createUser('Asha', '');
  expect(await app.startup.initBackend()).toBeNull();
  expect(app.storage.StorageService.getItemSync(KEY)).toBe('2.7.1');
});

it('leaves an existing flag alone, with or without data', async () => {
  const app = coldStart();
  app.storage.StorageService.setItemSync(KEY, '2.8.0');
  await app.users.createUser('Asha', '');
  expect(await app.startup.initBackend()).toBeNull();
  expect(app.storage.StorageService.getItemSync(KEY)).toBe('2.8.0');
});

it('records nothing when the database cannot be read, so the next start decides', async () => {
  jest.doMock('../../src/data/database/database', () => ({
    database: {
      get: () => ({
        query: () => ({
          fetchCount: () => Promise.reject(new Error('database disk image is malformed')),
          fetch: () => Promise.reject(new Error('no database')),
        }),
      }),
      write: async () => undefined,
      batch: () => undefined,
    },
    getDatabaseError: () => null,
  }));
  const app = coldStart();
  expect((await app.startup.initBackend())?.message).toBe('database disk image is malformed');
  expect(app.storage.StorageService.getItemSync(KEY)).toBeNull();
});
