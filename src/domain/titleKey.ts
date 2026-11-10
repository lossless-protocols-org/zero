/**
 * When two expense titles are "the same": outer spaces dropped and ASCII
 * letters lowered, exactly as SQLite computes `lower(trim(title))` ("Chai "
 * matches "chai"; "Çay" and "çay" stay apart, as SQLite's lower() leaves
 * non-ASCII letters alone). Categorise-from-history must use SQLite's rule
 * because an index on that expression answers its query; "Add again" uses
 * the same one so the two features never disagree about a title (audit
 * 2026-11-08 §3.13).
 */
export const titleKey = (title: string): string =>
  title.replace(/^ +| +$/g, '').replace(/[A-Z]/g, c => c.toLowerCase());
