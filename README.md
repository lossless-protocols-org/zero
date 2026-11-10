<div align="center">
    &nbsp;&nbsp;&nbsp;
    <img src="assets/icons/adaptive-icon-light.png" height="300" alt="zero logo light">
    <h1 align="center">zero - Minimal Expense Manager</h1>
</div>

zero is a lightweight, open-source expense tracking app for Android & iOS, built by [Lossless Protocols](https://lossless.dev). All your financial data stays on your device. No servers, no accounts, no analytics — the release build does not even hold the INTERNET permission.

## Get it

- [Play Store](https://play.google.com/store/apps/details?id=com.anotherwhy.zero) · [App Store](https://apps.apple.com/in/app/zero-offline-expense-tracker/id6759560225)
- [GitHub Releases](https://github.com/lossless-protocols-org/zero/releases) — every release carries the signed APK.
  The GitHub APK is signed with a different key than the Play build, so one cannot be installed over the other: **Settings → Export data** first, uninstall, install, import.

## Community and support

- Releases and discussion: [#zero-updates on Discord](https://discord.gg/qxD79s6v3H)
- Bug reports: [#zero-bugs on Discord](https://discord.gg/2G7yYu9GY7) or a [GitHub issue](https://github.com/lossless-protocols-org/zero/issues/new/choose)
- Email: hello@lossless.dev

If zero crashes, it offers once, on the next launch, to share the error with us; nothing is sent unless you tap Share. The same log is in **Settings → Diagnostics**, where you can share or email it yourself. It holds error messages and code locations — never your transactions.

## Screenshots

<div style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center;">
   <img src="assets/screenshots/zero_home_screen_dark.png" width="200"/>
   <img src="assets/screenshots/zero_home_screen_light.png" width="200"/>
   <img src="assets/screenshots/zero_report_screen_dark.png" width="200"/>
   <img src="assets/screenshots/zero_report_screen_light.png" width="200"/>
   <img src="assets/screenshots/zero_debts_screen_dark.png" width="200"/>
   <img src="assets/screenshots/zero_debts_screen_light.png" width="200"/>
   <img src="assets/screenshots/zero_settings_screen_dark.png" width="200"/>
   <img src="assets/screenshots/zero_settings_screen_light.png" width="200"/>
   <img src="assets/screenshots/zero_categories_screen_dark.png" width="200"/>
   <img src="assets/screenshots/zero_categories_screen_light.png" width="200"/>
</div>

## Features

### Expense Tracking

- Add, edit, and delete transactions with customizable categories
- Calculator in amount fields (Settings, off by default): type `120+45×2`, see the result as you type
- The category of an expense you have entered before is chosen for you, from your own history, on the device
- Sort a month by date, category, title or amount

### Money In and Refunds

- Record money in (salary, a client, interest) and see what you received and what you kept each month
- "Got money back" on an expense: a refund counts in the month the money came back

### Widgets and Quick Add

- Home-screen widgets on Android and iOS: this month's spending, today, one tap to add
- Add an expense without opening the app: a small sheet over the home screen from the widget, a Quick Settings tile or a launcher shortcut (Android); Siri, Shortcuts or the Action Button (iOS)

### Category Management

Create your own categories with custom icons and colors, and drag them into the order you want.

### Insights & Reports

- Monthly spending breakdown with a donut chart
- Heatmap calendar showing daily expenses
- Average per day calculations

### Budget

A monthly budget with an adaptive daily allowance: what is left, divided over the days that remain.

### Debt Tracking

Track money you owe or are owed, in the Money tab. Debts are what you hold and owe, not spending or income, so they never change a month's totals.

### Customization

- Light & Dark themes (+ system default)
- Every ISO 4217 currency, with the symbol placed the way your locale expects
- Week starting Sunday or Monday
- Personalized username

### Data Control

- Export all data as JSON; import on a new device
- Export expenses as CSV
- Delete all data (with a backup offered first)

### Privacy First

- 100% offline — no internet permission in the release build
- All data stored locally on device (SQLite)
- Zero data collection, zero crash reporters, zero analytics
- zero never reads your SMS, notifications, email, bank data, contacts or clipboard. `scripts/check-no-read.mjs` fails the build if any manifest, dependency, Info.plist or entitlement asks for one of them, and the release gate runs it on the built APK

## How zero is built

- **Flows and positions are different things.** Spending, refunds and money in are money moving during a month; debts are what you hold and owe. A month's totals only ever count the first.
- **One table per fact.** Expenses, refunds, money in and debts live in their own tables; a row's table says what it is.
- **Derive, never store.** Spent, received and kept are computed when you look, never kept in a running total that could drift.
- **Amounts are positive; the table gives the direction.** Sums run in integers, so ₹0.10 + ₹0.20 is ₹0.30.
- **Adding an expense stays fast.** The add-expense flow keeps the same taps in every version.
- **Your data, your device.** Backups are plain JSON files you keep; nothing leaves the phone unless you share it.

## Tech Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Framework  | React Native 0.88 (New Architecture, Hermes) |
| Language   | TypeScript 6.0 (strict)                      |
| Database   | WatermelonDB (SQLite + JSI)                  |
| State      | Redux Toolkit                                |
| Validation | Zod 4                                        |
| UI         | Custom atomic components + Lucide icons      |
| Navigation | React Navigation 7                           |
| Lists      | FlashList                                    |
| Storage    | MMKV (preferences & persistence)             |

### Why WatermelonDB?

We migrated from Realm to WatermelonDB because:

- **Realm is deprecated** — MongoDB announced end of support
- **SQLite is battle-tested** — Powers millions of apps
- **Lazy loading** — Only loads data when needed
- **Better React Native integration** — Built specifically for RN
- **Smaller bundle size** — Less bloat

## Project Structure

Lowest layer first. A module imports only from its own layer or a lower one,
and no feature imports another feature. dependency-cruiser enforces it on every
test run (`.dependency-cruiser.cjs` holds the rules; `bun run check:layers`), and
knip finds anything unused (`bun run check:exports`). Native code, the widgets
and the generated assets are mapped in [docs/NATIVE.md](docs/NATIVE.md); tests
live in one tree, [`__tests__/`](__tests__/README.md).

```
src/
├── domain/            # Pure rules and types: money units, day keys, period, budget and debt maths
├── constants/         # Outbound links
├── platform/          # The device: MMKV storage and preferences, locale and formatting, error log
├── i18n/              # Strings and validation messages
├── data/              # The data layer
│   ├── database/      # WatermelonDB schema, migrations, models, v5 backfill, seeded defaults
│   ├── services/      # Every read and write, each enforcing its own invariants
│   ├── dataMigrations/# Sequential data migrations run at start
│   ├── backup/        # Export format, upgrader, validation, import planner, file IO
│   └── startup.ts     # Opens the database and runs pending migrations
├── native/            # TurboModule specs (codegen); only features/widgets/bridge.ts uses them
├── store/             # Redux Toolkit: slices, session start (bootstrapSession), middleware
├── ui/                # Shared view code: hooks and contexts → atoms → molecules → sheets
├── features/          # One product area each: lib → hooks → components → sheets → screens
│   ├── spending/      # Home, the day and category lists, add/edit expense, refunds
│   ├── money/         # The Money tab: money in and debts
│   ├── categories/    # The Categories tab, add/edit, icon and colour pickers
│   ├── reports/       # Reports: donut, heatmap, money-in strip
│   ├── settings/      # Settings, Diagnostics, preference pickers
│   ├── onboarding/    # Splash, welcome, name, categories, currency, restore
│   └── widgets/       # Home-screen widget snapshot, the Siri/widget queue, the quick-add sheet
└── navigation/        # The app shell: stacks, deep links, the sheet registry

__tests__/             # Every test, by kind: unit/ and component/ mirror src/ (see its README)
contracts/             # Fixtures the JS, Kotlin and Swift sides all read
```

## Building from source

### Prerequisites

- Node.js >= 22.13
- Bun (package manager)
- Android Studio / Xcode 16.1+

```bash
git clone https://github.com/lossless-protocols-org/zero.git
cd zero
bun install

# iOS only
cd ios && pod install && cd ..

bun run android   # or bun run ios
bun run typecheck # tsc --strict
bun run test      # jest (every suite but the SQLite ones)
bun run test:sqlite # bun: WatermelonDB's SQL on real SQLite
bun run check     # the whole JS gate, as CI runs it
```

## Contributing

zero is developed in-house at Lossless and stays deliberately small, so pull requests are not accepted. Bug reports and ideas are very welcome — on Discord, in GitHub issues, or by email. Please read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Legal

- [Privacy Policy](https://lossless.dev/zero/privacy) — zero collects nothing; the page itemizes the nothing
- [Terms](https://lossless.dev/zero/terms)

## License

zero is free software, licensed under the [GNU General Public License, version 3 or later](LICENSE). You may use, study, change and share it; if you distribute a changed version, you must publish its source under the same licence.

- The names "zero" and "Lossless", the icon, the logo and the store artwork are not covered by that licence. A changed version needs its own name and artwork. See [NOTICE](NOTICE).
- Version 2.8.0 and earlier were published under the [BSD 2-Clause License](LICENSES/BSD-2-Clause.txt), which still applies to those versions.

---

<div align="center">
  <p>Built with ❤️ in India</p>
  <p><i>Embrace the simplicity of zero</i></p>
</div>
