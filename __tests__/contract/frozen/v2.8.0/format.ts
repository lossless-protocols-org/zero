// FROZEN: the refusal 2.8.x applies to a backup from a newer app, from src/data/backup/export/format.ts
// at tag v2.8.0 (CURRENT_EXPORT_VERSION = 5). Never edit.
export const CURRENT_EXPORT_VERSION = 5;
export const isEnvelopeTooNew = (version: number | undefined): boolean =>
  typeof version === 'number' && version > CURRENT_EXPORT_VERSION;
