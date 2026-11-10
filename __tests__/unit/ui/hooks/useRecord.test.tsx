/**
 * M19 (v2.7.1): edit screens get an id and read the current row, so a row
 * changed or deleted elsewhere is never edited from a stale copy.
 */
import {renderHook} from '@testing-library/react-native';
import {useRecord} from '../../../../src/ui/hooks/useRecord';
import {clearErrorLog, getErrorLog} from '../../../../src/platform/errorLog';

const mount = async (load: (id: string) => Promise<string | null>) =>
  (await renderHook(() => useRecord('id-1', load))).result;

it('is ready with the row', async () => {
  const state = await mount(id => Promise.resolve(`row ${id}`));
  expect(state.current).toEqual({status: 'ready', record: 'row id-1'});
});

it('is missing when the row is gone', async () => {
  const state = await mount(() => Promise.resolve(null));
  expect(state.current).toEqual({status: 'missing'});
});

it('is failed, and logs why, when the read throws', async () => {
  clearErrorLog();
  const state = await mount(() => Promise.reject(new Error('disk I/O error')));
  expect(state.current).toEqual({status: 'failed'});
  expect(getErrorLog().map(e => e.message)).toEqual(['disk I/O error']);
});
