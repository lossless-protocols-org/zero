import {Platform, Share} from 'react-native';
import RNFS from 'react-native-fs';
import {generateUniqueKey} from '../../backend/export/key';
import {getTimestamp} from '../../utils/dateUtils';
import {CURRENT_EXPORT_VERSION, type ExportDraft} from '../../backend/export/format';
import {expensesToCsv} from '../../backend/export/csv';
import {appendErrorLog} from '../../utils/errorLog';
import {validateExportEnvelope} from '../../backend/export/validate';
import type {ExportOutcome} from './useSettings';

/**
 * What the export flows need from the screen. Injected so the flows can be
 * tested without rendering Settings (L2, v2.7.1).
 */
export interface ExportDeps {
  /** Reads the database NOW; null when the read failed (already logged). */
  getAllData: () => Promise<ExportDraft | null>;
  /** `message` replaces the generic failure text when the cause is actionable; shown verbatim. */
  handleExportResult: (success: boolean, message?: string) => Promise<void>;
  /** Wraps "expenses row 4712 (…), amount: …" in the screen's copy (M2/L7). */
  invalidRowMessage: (detail: string) => string;
  requestStoragePermission: () => Promise<boolean>;
  requestStorageViaDialog: () => Promise<void>;
  shareTitle: string;
  /** Shown when the database holds no user row: there is nothing to back up (M2). */
  noUserMessage: string;
}

/**
 * Shared write path for every export format. Returns whether the bytes
 * reached somewhere the USER can actually get at, which is not the same as
 * "no exception was thrown":
 *
 * - iOS stages the file in TemporaryDirectoryPath and unlinks it once the
 *   share sheet is done (v2.7.1): the sandbox is app-private (Info.plist sets
 *   neither UIFileSharingEnabled nor LSSupportsOpeningDocumentsInPlace), so
 *   the share sheet is the only way the file escapes it, a DISMISSED share
 *   means there is no usable backup however successful the write was, and
 *   files left in Documents would pile up inside iCloud/Finder backups.
 * - Android writes straight to Downloads, permission-gated on API <= 32. A
 *   denied permission used to return silently here — no error, no result —
 *   so the caller could not tell a refusal from a success.
 *
 * `handleDeleteAllData` gates a permanent wipe on this outcome, so it must
 * never report optimistically.
 */
const writeAndShareFile = async (
  deps: ExportDeps,
  fileName: string,
  /** Serialised inside the guarded region: a throw here must also end as a logged 'failed'. */
  serialize: () => string,
): Promise<ExportOutcome> => {
  try {
    if (Platform.OS === 'ios') {
      // NSTemporaryDirectory() ends with a slash; DocumentDirectoryPath did not.
      const path = `${RNFS.TemporaryDirectoryPath.replace(/\/$/, '')}/${fileName}`;
      await RNFS.writeFile(path, serialize(), 'utf8');
      let result: Awaited<ReturnType<typeof Share.share>>;
      try {
        // Resolves from UIActivityViewController's completion handler, i.e.
        // after the chosen target has consumed the file. Known hazard (RN's
        // ActionSheetManager): if the user cancels INSIDE a target such as
        // Mail, some iOS versions may never settle this promise; then the
        // staged file stays until iOS clears tmp. Needs an iOS device check.
        result = await Share.share({
          url: `file://${path}`,
          title: deps.shareTitle,
        });
      } finally {
        // The share target has its own copy by now (or there is none). A
        // failed cleanup is not a failed export, but it goes in Diagnostics.
        await RNFS.unlink(path).catch((error: unknown) => {
          appendErrorLog(
            new Error(
              `export: could not remove staged file ${path}: ${error instanceof Error ? error.message : String(error)}`,
            ),
            false,
          );
        });
      }
      if (result.action === Share.dismissedAction) {
        return 'cancelled';
      }
      await deps.handleExportResult(true);
      return 'saved';
    }

    const storagePermissionGranted = await deps.requestStoragePermission();
    if (!storagePermissionGranted) {
      await deps.requestStorageViaDialog();
      return 'failed';
    }
    const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
    await RNFS.writeFile(path, serialize(), 'utf8');
    await deps.handleExportResult(true);
    return 'saved';
  } catch (error) {
    appendErrorLog(
      new Error(`export of ${fileName} failed: ${error instanceof Error ? error.message : String(error)}`),
      false,
    );
    await deps.handleExportResult(false);
    return 'failed';
  }
};

/**
 * The JSON backup. `handleDeleteAllData` awaits this as its backup-before-
 * delete step and will NOT wipe unless it returns 'saved'.
 *
 * Reads the database NOW rather than a redux snapshot: a budget set in the
 * sheet seconds earlier was missing from the file a snapshot produced (B8).
 */
export const exportJson = async (deps: ExportDeps): Promise<ExportOutcome> => {
  const dataToExport = await deps.getAllData();
  if (!dataToExport) {
    await deps.handleExportResult(false);
    return 'failed';
  }
  if (dataToExport.users.length === 0) {
    // The validator would refuse this file at restore anyway; say why now.
    appendErrorLog(new Error('Export refused: no user row'), false);
    await deps.handleExportResult(false, deps.noUserMessage);
    return 'failed';
  }
  const envelope = {key: generateUniqueKey(), version: CURRENT_EXPORT_VERSION, data: dataToExport};
  // The file must restore. Raw rows (L4) bypass the model layer's coercions,
  // so a corrupt value would otherwise only be discovered at restore time —
  // when it is the user's only copy.
  const validation = validateExportEnvelope(envelope);
  if (!validation.success) {
    appendErrorLog(new Error(`Export would not restore: ${validation.error ?? 'unknown validation error'}`), false);
    // Rows that an older, laxer import accepted can sit in the database; the
    // user must be told WHICH one, or export and delete-all are both blocked
    // with no way out.
    const detail = describeInvalidRow(dataToExport, validation.issuePath, validation.error);
    await deps.handleExportResult(false, detail ? deps.invalidRowMessage(detail) : undefined);
    return 'failed';
  }
  // No pretty-printing (L4): indentation was ~45% of the file at 10k rows and
  // the import never needed it.
  return writeAndShareFile(deps, `zero_v${CURRENT_EXPORT_VERSION}_${getTimestamp()}.json`, () =>
    JSON.stringify(envelope),
  );
};

/** "expenses row 4712 (\"Petrol\", 2024-13-45), amount: must not be negative" when the row can be found. */
const describeInvalidRow = (
  data: ExportDraft,
  issuePath: string[] | undefined,
  error: string | undefined,
): string | undefined => {
  if (!error) {
    return undefined;
  }
  const [root, table, index] = issuePath ?? [];
  if (root !== 'data' || !table || index === undefined) {
    return error;
  }
  const rows: unknown = data[table as keyof ExportDraft]; // table comes from the validated schema's own path
  const row: unknown = Array.isArray(rows) ? rows[Number(index)] : undefined;
  if (!row || typeof row !== 'object') {
    return error;
  }
  const label =
    'title' in row && typeof row.title === 'string'
      ? row.title
      : 'description' in row && typeof row.description === 'string'
        ? row.description
        : 'name' in row && typeof row.name === 'string'
          ? row.name
          : undefined;
  const when =
    'date' in row && typeof row.date === 'string'
      ? row.date
      : 'month' in row && typeof row.month === 'string'
        ? row.month
        : undefined;
  const where = [label ? `"${label}"` : undefined, when].filter(Boolean).join(', ');
  return where ? error.replace(/^(\w+ row \d+)/, `$1 (${where})`) : error;
};

/**
 * One-way spreadsheet export; JSON stays the only restore format. A failed
 * read is a failed export — there is no fallback to older data (L2).
 */
export const exportCsv = async (deps: ExportDeps): Promise<ExportOutcome> => {
  const data = await deps.getAllData();
  if (!data) {
    await deps.handleExportResult(false);
    return 'failed';
  }
  return writeAndShareFile(deps, `zero_expenses_${getTimestamp()}.csv`, () => expensesToCsv(data.expenses));
};
