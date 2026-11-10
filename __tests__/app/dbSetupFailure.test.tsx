/**
 * M3 (v2.7.1): a database that fails to open was only noticed when a data
 * migration happened to be pending, because `_databaseError` is set inside the
 * database setup and `runMigrations()` returns before touching the DB
 * when nothing is pending — i.e. on every upgraded device. `initBackend` now
 * probes the database, so an upgraded install (MMKV migration version already
 * current) still reaches `DatabaseErrorFallback`.
 */
import React from 'react';
import {render, screen} from '@testing-library/react-native';
import App from '../../App';
import {StorageService} from '../../src/platform/storage';
import {isOnboardedPreference} from '../../src/platform/onboarding';
import {DATA_MIGRATIONS} from '../../src/data/dataMigrations/registry';
import {database} from '../../src/data/database/database';
import {getErrorLog} from '../../src/platform/errorLog';

// jest.mock factories cannot close over test variables; the mock keeps its own
// state (prefixed `mock` so jest allows it) and exposes it for assertions.
const mockSetup: {error: Error | null; setupFails: boolean} = {error: null, setupFails: true};

jest.mock('../../src/data/database/database', () => ({
  // The adapter's onSetUpError fires the first time the database is touched.
  database: {
    get: jest.fn(() => ({
      query: () => ({
        fetchCount: async () => {
          if (mockSetup.setupFails) {
            mockSetup.error = new Error('SQLite setup failed: unable to open database file');
            throw mockSetup.error;
          }
          // A file that opens but fails on its first read: onSetUpError never fires.
          throw new Error('database disk image is malformed');
        },
        fetch: async () => {
          throw new Error('no database');
        },
      }),
    })),
    write: jest.fn(async () => undefined),
    batch: jest.fn(),
  },
  getDatabaseError: () => mockSetup.error,
}));

/** Mounts the app and waits for the start-up probe to settle on the fallback. */
const showApp = async (): Promise<string[]> => {
  await render(<App />);
  await screen.findByText('Database failed to load');
  return screen.container.queryAll(node => node.type === 'Text').map(node => node.children.join(''));
};

describe('database setup failure on an upgraded install', () => {
  it('shows DatabaseErrorFallback even when no data migration is pending', async () => {
    // Upgraded device: every data migration already applied.
    const latest = Math.max(...DATA_MIGRATIONS.map(m => m.version));
    StorageService.setNumber('data_migration_version', latest);
    isOnboardedPreference.set(true);

    const texts = await showApp();
    expect(texts).toContain('SQLite setup failed: unable to open database file');
    // The probe, not a mounted screen, is what touched the database.
    expect(database.get).toHaveBeenCalledWith('users');
    expect(mockSetup.error).not.toBeNull();
    // Logged exactly once (fatal), by App.
    const logged = getErrorLog().filter(e => e.message.includes('unable to open database file'));
    expect(logged).toHaveLength(1);
    expect(logged[0]?.fatal).toBe(true);
  });

  it('shows the fallback for a database that opens but fails on its first read', async () => {
    mockSetup.setupFails = false;
    mockSetup.error = null;
    expect(await showApp()).toContain('database disk image is malformed');
  });

  it('never advises reinstalling, which would delete the kept data file', async () => {
    const copy = (await showApp()).join(' ');
    expect(copy).not.toMatch(/reinstall/i);
    expect(copy).toMatch(/don't uninstall/i);
  });
});
