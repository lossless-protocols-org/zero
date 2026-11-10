/**
 * M21 (v2.7.1): the data migration that moves old palette colours to the WCAG palette, run against a real (LokiJS) database on upgrade.
 */
import {migration_002} from '../../../../../src/data/dataMigrations/scripts/002_remap_category_colors';
import {readIconRows as read, seedIconRows as seed} from '../../../../harness/iconRows';

it('remaps old palette colours, whatever their case, and keeps custom ones', async () => {
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
