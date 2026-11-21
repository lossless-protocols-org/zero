# contracts/

Fixtures that more than one language reads. The JavaScript side writes them (one is written by hand, as marked); the Kotlin and Swift sides are tested against the same files (not copies), so a change on any side fails a suite.

| File                            | Written by (jest)                                                                                                                                  | Read by                                                                                                                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `widget-snapshot-contract.json` | `__tests__/contract/widgetContract.test.ts` (the snapshot `src/features/widgets/snapshot.ts` builds)                                               | `WidgetSnapshotTest.kt` (on the test classpath via `android/app/build.gradle`), `ios/ZeroShared/Tests/ZeroSharedTests/WidgetSnapshotContractTests.swift`                                                                                                                             |
| `money-format-cases.json`       | `__tests__/contract/moneyFormatSpec.test.ts` (the app's own `formatAmountWithSymbol`, 10 currency/locale pairs × 11 amounts)                       | `ios/ZeroShared/Tests/ZeroSharedTests/MoneyTests.swift` (the Swift twin, `MoneyFormat`)                                                                                                                                                                                              |
| `billing-scenarios.json`        | By hand (3.0): each store situation as the platform's own facts, the answer the native side must give for them, and what that answer means for Pro | `__tests__/contract/billingScenarios.test.ts` (the app accepts every answer and reduces it to the stated entitlement), `ios/ZeroBilling/Tests/BillingScenariosTests.swift` and `android/app/src/testPlay/…/PlayAnswerScenariosTest.kt` (each store's facts give exactly that answer) |
| `backup-format.json`            | `__tests__/contract/backupFormat.test.ts` (Node's own crypto: the reference for docs/BACKUP_FORMAT.md; 4 files and 9 refusals)                     | `BackupFormatTest.kt`, `ios/ZeroBackup/Tests/…/BackupFormatTests.swift` (each opens every file, refuses every reject with the same answer, and writes the reference header)                                                                                                          |
| `report-doc.json`               | `__tests__/unit/features/reports/reportDocs.test.ts` (the PDF report builders: a month, a long one, trends, a right-to-left one)                   | `ReportPdfTest.kt`, `ios/ZeroReports/Tests/…/ReportPdfTests.swift` (each parses every document and draws it)                                                                                                                                                                         |

After a deliberate change, regenerate and commit the file with the change:

```bash
ZERO_UPDATE_WIDGET_CONTRACT=1 bunx jest __tests__/contract/widgetContract.test.ts   # then bump WIDGET_SNAPSHOT_VERSION if old readers would misread it
ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/contract/moneyFormatSpec.test.ts
ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/contract/backupFormat.test.ts
ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/unit/features/reports/reportDocs.test.ts
```

Run every side: `bun run test` (JS), `bun run test:android` (Kotlin), `bun run test:ios` (Swift). CI runs all three.
