/**
 * M22 (v2.7.1): the data migration that repairs stored icon and colour text, run against a real (LokiJS) database on upgrade.
 */
import {migration_001} from '../../../../../src/data/dataMigrations/scripts/001_sanitize_icon_color';
import {DEFAULTS} from '../../../../../src/domain/sanitize';
import {readIconRows as read, seedIconRows as seed} from '../../../../harness/iconRows';

it('replaces the stored "null"/""/"undefined" icon and colour, and leaves good values alone', async () => {
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
