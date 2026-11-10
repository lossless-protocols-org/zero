/**
 * Epoch milliseconds of a stored date ('YYYY-MM-DD' or local
 * 'YYYY-MM-DDTHH:mm:ss'), read as UTC — exactly what the v5 migration's
 * `strftime('%s', substr(date, 1, 19)) * 1000` computes in SQLite, so an
 * upgraded device and a restored backup give old rows the same `created_at`.
 * Returns null for anything that is not such a date.
 */
const ISO_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

export const epochFromIsoDate = (date: string): number | null => {
  const m = ISO_PREFIX.exec(date);
  if (!m) {
    return null;
  }
  const [year, month, day, hour, minute, second] = m.slice(1).map(part => Number(part ?? 0));
  // the regex has six groups; missing time parts read as 0 above
  const ms = Date.UTC(year as number, (month as number) - 1, day, hour, minute, second);
  return Number.isNaN(ms) ? null : ms;
};
