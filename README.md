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

Add, edit, and delete transactions with customizable categories.

### Category Management

Create your own categories with custom icons and colors.

### Insights & Reports

- Monthly spending breakdown with a donut chart
- Heatmap calendar showing daily expenses
- Average per day calculations

### Budget

A monthly budget with an adaptive daily allowance: what is left, divided over the days that remain.

### Debt Tracking

Track money you owe or are owed. Manage debtors and individual debts.

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

## Tech Stack

| Layer      | Technology                                   |
| ---------- | -------------------------------------------- |
| Framework  | React Native 0.86 (New Architecture, Hermes) |
| Language   | TypeScript 5.9 (strict)                      |
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

```
src/
├── components/        # Reusable UI components (atomic design)
│   ├── atoms/         # Basic components (Button, Input, Text, ErrorBoundary)
│   └── molecules/     # Composite components
├── screens/           # App screens
│   └── ScreenName/
│       ├── index.tsx          # UI component
│       └── useScreenName.ts   # Business logic hook
├── watermelondb/      # Database layer
│   ├── models/        # WatermelonDB model classes
│   ├── services/      # CRUD operations
│   ├── schema.ts      # Database schema
│   ├── migrations.ts  # Schema migrations
│   └── database.ts    # DB initialization (lazy Proxy)
├── backend/           # Startup & data logic
│   ├── export/        # Export format, upgrader, validation
│   └── migrations/    # Sequential data migrations
├── constants/         # Outbound links, icon tables
├── redux/             # Redux Toolkit slices & store
├── navigation/        # React Navigation config
├── context/           # React Context providers (Theme, Dialog)
├── hooks/             # Global hooks
├── styles/            # Global styles (utility-first)
├── utils/             # Helper functions
└── sheets/            # Bottom sheet components
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
bun run test      # jest
bun test          # bun runner
```

## Contributing

zero is developed in-house at Lossless and stays deliberately small, so pull requests are not accepted. Bug reports and ideas are very welcome — on Discord, in GitHub issues, or by email. Please read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Legal

- [Privacy Policy](https://lossless.dev/zero/privacy) — zero collects nothing; the page itemizes the nothing
- [Terms](https://lossless.dev/zero/terms)

## License

This project is licensed under the [BSD 2-Clause License](LICENSE).

---

<div align="center">
  <p>Built with ❤️ in India</p>
  <p><i>Embrace the simplicity of zero</i></p>
</div>
