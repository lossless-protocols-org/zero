/** The major number of an app version ("2.8.0" → 2), or null for anything that does not start with one. */
export const majorOf = (version: string | null): number | null => {
  const major = /^(\d+)\./.exec(version ?? '')?.[1];
  return major === undefined ? null : Number(major);
};

/** The release that introduced zero Pro. */
export const PRO_MAJOR = 3;
