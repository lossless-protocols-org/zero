// swift-tools-version: 5.10
import PackageDescription

// The Swift the app and its widget extension share (2.8), as a package so it
// can be tested on its own (audit 2026-11-08 §6.1). The app and the widget
// compile these same files as members of each target, deliberately: the app
// supports iOS 15.1 and this package iOS 17; App Intents need target
// membership for Siri's metadata; and the strings resolve from the main
// bundle. __tests__/arch/sharedSwiftSources.test.ts keeps the three lists
// (here, the app's and the widget's) identical, which is the drift risk two
// compilations carry. docs/NATIVE.md has the full reasoning.
//
//   cd ios/ZeroShared
//   xcodebuild test -scheme ZeroShared -destination 'platform=iOS Simulator,name=iPhone 18 Pro'
//
// The tests read the fixtures the JS and Kotlin sides read, from contracts/.
let package = Package(
  name: "ZeroShared",
  defaultLocalization: "en",
  platforms: [.iOS(.v17)],
  products: [.library(name: "ZeroShared", targets: ["ZeroShared"])],
  targets: [
    .target(
      name: "ZeroShared",
      path: ".",
      exclude: ["Tests"],
      sources: ["MoneyFormat.swift", "SharedStore.swift", "WidgetSnapshot.swift", "ZeroIntents.swift", "ZeroCards.swift"],
      resources: [.process("Localizable.xcstrings")],
      // Swift 6's data-race checks, on the package first (audit 2026-11-08
      // §6.3): what passes here is what the app and widget compile.
      swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
    ),
    .testTarget(
      name: "ZeroSharedTests",
      dependencies: ["ZeroShared"],
      path: "Tests/ZeroSharedTests"
    ),
  ]
)
