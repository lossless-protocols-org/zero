# Release QA checklist

Run this before every release, against the **actual release artifact** (`.aab` /
`.ipa`), on **real hardware**. Debug builds and simulators hide production-only
failures: Hermes behaviour, `console.*` suppression, storage permissions,
low-memory kills, and R8/ProGuard differences.

Zero ships no crash reporter and no analytics by design — the only signals that
a build is sound are the automated gate below and this manual pass.

## 1. Automated gate (must be green before building)

```bash
bun run typecheck    # tsc --strict
bun run lint         # eslint (flat config, ESLint 9)
bun run test         # jest — full suite incl. App render smoke test
bun test             # bun — pure suites, fast second opinion
cd android && ./gradlew assembleDebug
```

## 2. Build the real artifact

- [ ] `bun run version:set` — versionName and versionCode both bumped
- [ ] `cd android && ./gradlew bundleRelease`
- [ ] iOS: `bundle exec pod install` then Archive from Xcode
- [ ] Install the release build on device (not Metro, not debug)

## 3. Privacy verification (Lossless Protocol claims)

- [ ] `aapt dump permissions <release apk>` → **no `android.permission.INTERNET`**;
      storage permissions capped at `maxSdkVersion="32"`
- [ ] Play Console pre-launch report shows no network access
- [ ] Settings → "What leaves this device" renders and reads correctly
- [ ] `grep -rn "fetch(\|XMLHttpRequest\|WebSocket" src/` returns nothing

## 4. Critical flows (both platforms)

- [ ] Fresh install → onboarding → name → categories → currency → first expense
- [ ] **Tap the header back arrow (not the hardware back key) on every screen
      that has one**: Add/Edit category, Add/Edit debt, Add/Edit person, a
      person's debts, Reports → category drill-down, Reports → day drill-down,
      Settings, Diagnostics. v2.6.6 crashed on six of these (`goBack` invoked
      with the press event); the hardware key does not exercise that path.
- [ ] Add / edit / delete an expense; confirm the daily-budget line is right
      **when editing** (it must not double-count the amount being edited)
- [ ] Delete a transaction and let the 3s undo window elapse → stays deleted
- [ ] Delete a transaction, then **scroll the row off-screen** within 3s →
      the delete still commits and the row does not come back
- [ ] Delete a transaction, then **background/kill the app** within 3s →
      no resurrection
- [ ] Category create / edit / soft-delete (with confirmation)
- [ ] Verify a soft-deleted category still resolves on old transactions
- [ ] Debtor + debts: create, edit, settle, delete debtor (deletes their debts)
- [ ] Reports: donut renders, centre total matches the legend sum, tapping a
      legend row opens that category
- [ ] Reports: empty month, single-category month, many-category month
- [ ] Month navigation across a year boundary; no flicker

## 5. Backup / restore

- [ ] Export → wipe → restore: expenses, categories, debts, **budgets**, and
      soft-delete statuses all return
- [ ] Restore a backup with duplicate category names → merged, not duplicated
- [ ] Cancel the "replace all data" dialog → existing data untouched
- [ ] Restore on **Android 10, 11 or 12** specifically (storage permission path)
- [ ] After restore, the month/year picker shows the restored data's years

## 6. Locale, theme, accessibility

- [ ] Switch theme (light / dark / system) — including a system-level change
      while the app is open
- [ ] Switch language, then re-open the month picker: month names update and
      previously-saved months still resolve (no empty month)
- [ ] Non-Latin name in onboarding (e.g. `हिंदी`, `José`) is accepted
- [ ] Currency formatting: an INR device shows lakh grouping for INR but
      **not** for USD/RUB/HUF
- [ ] Screen reader: swipe actions announce Edit/Delete; the budget
      "every month" row announces as a switch with its state
- [ ] Large system font / display size does not clip the home header or sheets

## 7. Edge and adversarial

- [ ] Airplane mode throughout (the app must not care)
- [ ] Denied storage permission → clear message, offer to open settings
- [ ] Force-kill mid-write (add an expense and kill immediately) → no corruption
- [ ] Very long titles, very large amounts, rapid double-taps on Continue
      during onboarding (must not create duplicate categories/currencies)
- [ ] Low storage
- [ ] Cold start time and list scroll feel unchanged vs the previous release
- [ ] Settings → Diagnostics lists recorded errors and clears them

## 8. Sign-off

- [ ] Automated gate green
- [ ] Sections 3–7 walked on at least one recent iPhone and one mid/low-end Android
- [ ] Note the OS versions and devices used in the release notes
