/** The automatic backup's Settings line (P10): off, waiting for the first, needing attention, or when the last was made. */
import {act} from '@testing-library/react-native';
import {useAutoBackupSummary} from '../../../../src/ui/hooks/useAutoBackupSummary';
import {
  autoBackupLastAtPreference,
  autoBackupOnPreference,
  autoBackupStatusPreference,
} from '../../../../src/platform/backupPreferences';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

it('follows the backup as it changes', async () => {
  autoBackupOnPreference.set(false);
  autoBackupLastAtPreference.set(0);
  autoBackupStatusPreference.set('none');
  const {result} = await renderHookInApp(() => useAutoBackupSummary());
  expect(result.current).toEqual({text: 'settings.autoBackupOff', problem: false});
  await act(async () => autoBackupOnPreference.set(true));
  expect(result.current).toEqual({text: 'settings.autoBackupWaiting', problem: false});
  await act(async () => autoBackupLastAtPreference.set(Date.UTC(2026, 10, 11, 16, 10)));
  expect(result.current).toEqual({text: 'settings.autoBackupLast', problem: false});
  for (const status of ['folderLost', 'noKey', 'failed'] as const) {
    await act(async () => autoBackupStatusPreference.set(status));
    expect(result.current).toEqual({text: 'settings.autoBackupProblem', problem: true});
  }
  await act(async () => autoBackupStatusPreference.set('ok'));
  expect(result.current.problem).toBe(false);
});
