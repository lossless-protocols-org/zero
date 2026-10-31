/**
 * M6 (v2.7.1): `getDebtorByDebtorId` caught every error and returned null, so
 * a database failure read as "not found" and the debtor screen rendered an
 * empty header with nothing logged. Not-found still returns null; anything
 * else propagates (and is then logged by thunkRejectionMiddleware).
 * LokiJS harness as in importService.test.ts.
 */
import type {Database} from '@nozbe/watermelondb';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('debtorLookupTest'),
);

// jest.mock above replaces the module; require keeps the import after the mock and the cast restores its static type.
const {database} = require('../src/watermelondb/database') as {database: Database};
const {createDebtor, getDebtorByDebtorId} =
  require('../src/watermelondb/services') as typeof import('../src/watermelondb/services');

describe('getDebtorByDebtorId (M6)', () => {
  it('returns the debtor when it exists and null when the id is unknown', async () => {
    const id = await createDebtor('Sam', 'u1', 'user', 'Person', '#444444');
    expect((await getDebtorByDebtorId(id))?.title).toBe('Sam');
    expect(await getDebtorByDebtorId('no-such-id')).toBeNull();
  });

  it('rethrows a database failure instead of reading it as "not found"', async () => {
    const collection = database.get('debtors');
    const spy = jest.spyOn(collection, 'find').mockRejectedValueOnce(new Error('disk I/O error'));
    try {
      await expect(getDebtorByDebtorId('any')).rejects.toThrow('disk I/O error');
    } finally {
      spy.mockRestore();
    }
  });
});
