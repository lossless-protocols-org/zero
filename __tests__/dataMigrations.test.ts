/**
 * M22/M21 (v2.7.1): the two data migrations that rewrite users' rows on
 * upgrade, run against a real (LokiJS) database.
 */
import type {Database} from '@nozbe/watermelondb';
import type CategoryModel from '../src/watermelondb/models/Category';
import type DebtorModel from '../src/watermelondb/models/Debtor';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('dataMigrationsTest'),
);

// required after jest.mock so the mock applies; each cast names the module's own type
const {database} = require('../src/watermelondb/database') as {database: Database};
const {migration_001} =
  require('../src/backend/migrations/scripts/001_sanitize_icon_color') as typeof import('../src/backend/migrations/scripts/001_sanitize_icon_color');
const {migration_002} =
  require('../src/backend/migrations/scripts/002_remap_category_colors') as typeof import('../src/backend/migrations/scripts/002_remap_category_colors');
const {DEFAULTS} = require('../src/utils/sanitize') as typeof import('../src/utils/sanitize');

const seed = async (rows: Array<{kind: 'category' | 'debtor'; name: string; icon: string; color: string}>) => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await database.write(async () => {
    for (const row of rows) {
      if (row.kind === 'category') {
        await database.get<CategoryModel>('categories').create(c => {
          c.name = row.name;
          c.icon = row.icon;
          c.color = row.color;
          c.userId = 'u1';
          c.categoryStatus = true;
        });
      } else {
        await database.get<DebtorModel>('debtors').create(d => {
          d.title = row.name;
          d.icon = row.icon;
          d.color = row.color;
          d.userId = 'u1';
          d.type = 'Friend';
          d.debtorStatus = true;
        });
      }
    }
  });
};

const read = async () => ({
  categories: (await database.get<CategoryModel>('categories').query().fetch())
    .map(c => [c.name, c.icon, c.color])
    .sort(),
  debtors: (await database.get<DebtorModel>('debtors').query().fetch()).map(d => [d.title, d.icon, d.color]).sort(),
});

it('001 replaces the stored "null"/""/"undefined" icon and colour, and leaves good values alone', async () => {
  await seed([
    {kind: 'category', name: 'Bad', icon: 'null', color: ''},
    {kind: 'category', name: 'Good', icon: 'pizza', color: '#123456'},
    {kind: 'debtor', name: 'Ravi', icon: 'undefined', color: 'null'},
  ]);
  await migration_001.up();
  expect(await read()).toEqual({
    categories: [
      ['Bad', DEFAULTS.icon, DEFAULTS.color],
      ['Good', 'pizza', '#123456'],
    ],
    debtors: [['Ravi', DEFAULTS.icon, DEFAULTS.color]],
  });
});

it('002 remaps old palette colours, whatever their case, and keeps custom ones', async () => {
  await seed([
    {kind: 'category', name: 'Orange', icon: 'x', color: '#ffa500'},
    {kind: 'category', name: 'Custom', icon: 'x', color: '#123456'},
    {kind: 'debtor', name: 'Ravi', icon: 'x', color: '#FF6347'},
  ]);
  await migration_002.up();
  expect(await read()).toEqual({
    categories: [
      ['Custom', 'x', '#123456'],
      ['Orange', 'x', '#C47030'],
    ],
    debtors: [['Ravi', 'x', '#D06850']],
  });
});
