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

/** The public bug sheet (Settings → Report a bug). */
export const BUG_REPORT_URL =
  'https://docs.google.com/spreadsheets/d/187UDxJbFloEUkxxX29ZJnAI7HSdhAAdSbIcAByc8CDU/edit?usp=sharing';

/** Store pages, opened on the review screen (Settings → Rate the app). */
export const APP_STORE_REVIEW_URL =
  'https://apps.apple.com/app/zero-offline-expense-tracker/id6759560225?action=write-review';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.anotherwhy.zero';

export const PRIVACY_POLICY_URL = 'https://lossless.dev/zero/privacy';
export const TERMS_URL = 'https://lossless.dev/zero/terms';
