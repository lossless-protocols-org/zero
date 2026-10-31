import type {ExportData} from './validate';
/**
 * Export format versioning.
 *
 * VERSION HISTORY:
 *   v0 (legacy) — no version field in JSON. icon/color may contain "null" strings.
 *   v1          — added version field. Sanitized icon/color/type values.
 *   v2          — aligned with DB schema v2. Same entity shape as v1,
 *                 establishes the convention: export version = schema version.
 *   v3          — WCAG 2.2 color compliance. Remaps old category/debtor colors
 *                 to the new accessible palette. DB schema stays at v2 (no schema
 *                 changes, only data-level color values).
 *   v4          — Added budgets table (DB schema v3). Exports now include
 *                 budget entries with amount, month, budgetType.
 *
 * RULES:
 *   - Bump when the ExportData shape or data semantics change.
 *   - Add a corresponding upgrader step in upgrader.ts (vN → vN+1).
 *   - NEVER remove old upgrader steps — a v0 file must still import into a v99 app.
 *
 * FILE NAMING:
 *   Exported files are named: zero_v{version}_{timestamp}.json
 *   Example: zero_v3_20260321163018.json
 *   The version in the filename matches the version inside the JSON.
 */
export const CURRENT_EXPORT_VERSION = 4;

/**
 * A file written by a NEWER app may carry fields this version does not know
 * how to restore. Importing it "successfully" would silently drop them — so it
 * is refused with a message telling the user to update (B8).
 */
export const isEnvelopeTooNew = (version: number | undefined): boolean =>
  typeof version === 'number' && version > CURRENT_EXPORT_VERSION;

export type {ExportData, ExportEnvelope} from './validate';

/**
 * What the export builds from the database, before validation: identical to
 * ExportData except that the users list may be empty (a device with no user
 * row). The export refuses that case with its own message before validating.
 */
export type ExportDraft = Omit<ExportData, 'users'> & {users: Array<ExportData['users'][number]>};
