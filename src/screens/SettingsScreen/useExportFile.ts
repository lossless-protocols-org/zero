import {useTranslation} from 'react-i18next';
import {getAllData} from '../../watermelondb/services';
import {requestStoragePermission} from '../../utils/dataUtils';
import {exportCsv, exportJson, type ExportDeps} from './exportFiles';
import type {ExportOutcome} from './useSettings';

/** The JSON backup and CSV exports, wired to the real data, permission prompt and copy. */
export const useExportFile = (
  handleExportResult: ExportDeps['handleExportResult'],
  requestStorageViaDialog: ExportDeps['requestStorageViaDialog'],
) => {
  const {t} = useTranslation();
  const deps: ExportDeps = {
    getAllData,
    handleExportResult,
    requestStoragePermission,
    requestStorageViaDialog,
    shareTitle: t('settings.exportShareTitle'),
    noUserMessage: t('settings.exportNoUser'),
    invalidRowMessage: detail => t('settings.exportInvalidRow', {detail}),
  };
  return {
    exportData: (): Promise<ExportOutcome> => exportJson(deps),
    exportCsvFile: (): Promise<ExportOutcome> => exportCsv(deps),
  };
};
