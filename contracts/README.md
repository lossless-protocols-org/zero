# contracts/

Fixtures that more than one language reads. The JavaScript side writes them; the Kotlin and Swift sides are tested against the same files (not copies), so a change on any side fails a suite.

| File                            | Written by (jest)                                                                                                            | Read by                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `widget-snapshot-contract.json` | `__tests__/contract/widgetContract.test.ts` (the snapshot `src/features/widgets/snapshot.ts` builds)                         | `WidgetSnapshotTest.kt` (on the test classpath via `android/app/build.gradle`), `ios/ZeroShared/Tests/ZeroSharedTests/WidgetSnapshotContractTests.swift` |
| `money-format-cases.json`       | `__tests__/contract/moneyFormatSpec.test.ts` (the app's own `formatAmountWithSymbol`, 10 currency/locale pairs × 11 amounts) | `ios/ZeroShared/Tests/ZeroSharedTests/MoneyTests.swift` (the Swift twin, `MoneyFormat`)                                                                  |

After a deliberate change, regenerate and commit the file with the change:

```bash
ZERO_UPDATE_WIDGET_CONTRACT=1 bunx jest __tests__/contract/widgetContract.test.ts   # then bump WIDGET_SNAPSHOT_VERSION if old readers would misread it
ZERO_UPDATE_CONTRACTS=1 bunx jest __tests__/contract/moneyFormatSpec.test.ts
```

Run every side: `bun run test` (JS), `bun run test:android` (Kotlin), `bun run test:ios` (Swift). CI runs all three.
