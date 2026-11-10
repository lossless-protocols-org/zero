# End-to-end flows (Maestro)

These flows drive the real release app on a device or emulator through its UI. They are the one kind of test that catches what jest cannot: native screens, the keyboard, the share sheet, and the bundled JS.

- `first-run.yaml`: onboarding, then the first expense, then a backup export. **It clears the app's data.** Run it on an emulator, or on the QA build (`APP_ID=com.anotherwhy.zero.qa`), never on a phone with real data.

## Running

1. Install the Maestro CLI (https://maestro.mobile.dev). It is a tool on your machine, not a project dependency.
2. Install a release or QA build on the device (`cd android && ./gradlew assembleQa`, then `adb install -r …/app-qa.apk`).
3. Run `bun run test:e2e`, or `maestro test __tests__/e2e/first-run.yaml -e APP_ID=com.anotherwhy.zero.qa`.

CI runs them weekly and on demand (`.github/workflows/e2e.yml`) on an Android emulator against the QA build.

Selectors are the English copy and accessibility labels from `src/i18n/locales/en.json`. When copy changes, update the flow in the same change.
