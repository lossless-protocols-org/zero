/**
 * Every outbound destination the app can open, in one place.
 *
 * These are the only URLs zero ever hands to the OS, and the release APK has
 * no INTERNET permission, so opening one is always a hand-off to the browser,
 * the mail app or the store — never a request made by zero itself. Keeping
 * them here means a changed invite or a moved repository is a one-line edit
 * with one place to review.
 */
export const SUPPORT_EMAIL = 'hello@lossless.dev';

/** Discord: #zero-updates — releases and discussion. Permanent invite. */
export const DISCORD_UPDATES_URL = 'https://discord.gg/qxD79s6v3H';

export const GITHUB_REPO_URL = 'https://github.com/lossless-protocols-org/zero';
