// swift-tools-version: 5.10
import PackageDescription

// PDF reports (3.0, plan P12), as a package so the drawing is tested on its
// own against contracts/report-doc.json, the report the JS builders write and
// Android draws too. The app compiles the same file as a member of its target
// (the ZeroShared arrangement; docs/NATIVE.md). ZeroReportPdfStore.swift (the
// cache folder and the share sheet) needs the app, so it is not in the package.
//
//   cd ios/ZeroReports
//   xcodebuild test -scheme ZeroReports -destination 'platform=iOS Simulator,name=iPhone 18 Pro'
let package = Package(
  name: "ZeroReports",
  platforms: [.iOS(.v15)],
  products: [.library(name: "ZeroReports", targets: ["ZeroReports"])],
  targets: [
    .target(
      name: "ZeroReports",
      path: ".",
      exclude: ["Tests", "ZeroReportPdfStore.swift"],
      sources: ["ReportPdf.swift"]
    ),
    .testTarget(
      name: "ZeroReportsTests",
      dependencies: ["ZeroReports"],
      path: "Tests/ZeroReportsTests"
    ),
  ]
)
