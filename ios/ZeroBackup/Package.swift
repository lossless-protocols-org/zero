// swift-tools-version: 5.10
import PackageDescription

// The encrypted backup's file format (3.0, plan P10), as a package so it is
// tested on its own against contracts/backup-format.json, the vectors the JS
// reference writes and Android reads too. The app compiles the same file as a
// member of its target (the ZeroShared arrangement; docs/NATIVE.md).
// ZeroBackupStore.swift (folder, Keychain, picker) needs UIKit and the app,
// so it is not in the package.
//
//   cd ios/ZeroBackup && swift test          # on the Mac
//   xcodebuild test -scheme ZeroBackup -destination 'platform=iOS Simulator,name=iPhone 18 Pro'
let package = Package(
  name: "ZeroBackup",
  platforms: [.iOS(.v15), .macOS(.v12)],
  products: [.library(name: "ZeroBackup", targets: ["ZeroBackup"])],
  targets: [
    .target(
      name: "ZeroBackup",
      path: ".",
      exclude: ["Tests", "ZeroBackupStore.swift"],
      sources: ["BackupFormat.swift"],
      swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
    ),
    .testTarget(
      name: "ZeroBackupTests",
      dependencies: ["ZeroBackup"],
      path: "Tests/ZeroBackupTests"
    ),
  ]
)
