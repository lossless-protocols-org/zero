import packageJson from '../../package.json';

/**
 * The app version string, read from package.json at bundle time. A static
 * import cannot fail at runtime, so there is nothing to catch here; the
 * migration runner compares this value to decide whether a permanent
 * migration failure belongs to the current build.
 */
export const getAppVersion = (): string => packageJson.version;
