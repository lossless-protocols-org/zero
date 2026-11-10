import {useTranslation} from 'react-i18next';
import {getAllData} from '../../../../data/services/getService';
import {requestStoragePermission} from '../../../../platform/storagePermission';
import {exportCsv, exportJson, type ExportDeps} from '../../../../data/backup/export/exportFiles';
import type {ExportOutcome} from '../../../../data/backup/export/exportFiles';

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
