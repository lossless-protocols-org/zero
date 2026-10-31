/**
 * M17 (v2.7.1): debt `type` was a free string at every write site. Writers now
 * take `DebtType` ('Borrow' | 'Lend'); rows already on devices (or imported)
 * may hold any spelling, so reads normalise once, in the service mapper.
 * LokiJS harness as in userRow.test.ts.
 */
import type {Database} from '@nozbe/watermelondb';
import type DebtModel from '../src/watermelondb/models/Debt';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('debtTypeTest'),
);

// required after jest.mock so the mock applies; each cast names the module's own type
const {database} = require('../src/watermelondb/database') as {database: Database};
const services =
  require('../src/watermelondb/services/debtService') as typeof import('../src/watermelondb/services/debtService');

it('reads a legacy spelling back as one of the two debt types', async () => {
  await database.write(async () => {
    await database.get<DebtModel>('debts').create(d => {
      d.description = 'old import';
      d.amount = 5;
      d.debtorId = 'p1';
      d.userId = 'u1';
      d.date = '2026-10-01T10:00:00';
      d.type = 'borrowing';
    });
  });
  await services.createDebt('u1', 7, 'new', 'p1', '2026-10-02T10:00:00', 'Lend');
  const types = (await services.getAllDebtsByUserIdAndDebtorId('u1', 'p1')).map(d => d.type).sort();
  expect(types).toEqual(['Borrow', 'Lend']);
});
