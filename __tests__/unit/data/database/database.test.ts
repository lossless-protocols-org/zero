/**
 * The database is built once, at import, as a plain WatermelonDB Database (no
 * Proxy on the normal path, audit 2026-11-08 §5). When the adapter cannot even
 * be constructed, the error is recorded for startup to report, and any use
 * rethrows it by name instead of failing somewhere deep.
 */
export {}; // a module, so its helpers do not share the global scope with other suites

// The module under test is the real one, not jest.setup.js's LokiJS stand-in.
jest.unmock('../../../../src/data/database/database');

const mockFailure: {error: Error | null} = {error: null};

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: class {
    constructor() {
      if (mockFailure.error) {
        throw mockFailure.error;
      }
    }
  },
}));
jest.mock('@nozbe/watermelondb', () => ({
  // The schema and models still need the real helpers; only the Database is a stand-in.
  ...jest.requireActual('@nozbe/watermelondb'),
  Database: class {
    get(table: string) {
      return `collection:${table}`;
    }
  },
}));

const load = () => {
  let loaded: typeof import('../../../../src/data/database/database') | undefined;
  jest.isolateModules(() => {
    loaded =
      require('../../../../src/data/database/database') as typeof import('../../../../src/data/database/database'); // the module's own type
  });
  return loaded as typeof import('../../../../src/data/database/database'); // isolateModules runs synchronously
};

afterEach(() => {
  mockFailure.error = null;
});

it('is the Database itself, with no setup error', () => {
  const {database, getDatabaseError} = load();
  expect(database.get('users')).toBe('collection:users');
  expect(getDatabaseError()).toBeNull();
});

it('records a constructor failure for startup and rethrows it, by name, on any use', () => {
  mockFailure.error = new Error('JSI bindings missing');
  const {database, getDatabaseError} = load();
  expect(getDatabaseError()).toBe(mockFailure.error);
  expect(() => database.get('users')).toThrow('JSI bindings missing');
});
