import Foundation

/// The fixtures every side of the widget contract reads, from the repository's
/// contracts/ folder (not a copy): the JS builder writes them, Kotlin and these
/// tests read them, so a change on any side fails a suite.
enum Fixtures {
  /// The repository root: this file is ios/ZeroShared/Tests/ZeroSharedTests/Fixtures.swift.
  static let repo: URL = {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { url.deleteLastPathComponent() }
    return url
  }()

  static func data(_ name: String) throws -> Data {
    try Data(contentsOf: repo.appendingPathComponent("contracts").appendingPathComponent(name))
  }

  /// One named snapshot of contracts/widget-snapshot-contract.json, as the JSON string the app writes.
  static func contract(_ key: String, editing edit: (inout [String: Any]) -> Void = { _ in }) throws -> String {
    let all = try JSONSerialization.jsonObject(with: data("widget-snapshot-contract.json")) as? [String: Any]
    guard var object = all?[key] as? [String: Any] else {
      throw NSError(domain: "Fixtures", code: 1, userInfo: [NSLocalizedDescriptionKey: "no \(key) in the contract"])
    }
    edit(&object)
    let out = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    return String(decoding: out, as: UTF8.self)
  }

  /// A local date in the Gregorian calendar of the device's zone, as the widget reads the clock.
  static func at(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 12) -> Date {
    let calendar = Calendar(identifier: .gregorian)
    return calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!  // a valid fixed date
  }

  static let calendar = Calendar(identifier: .gregorian)
}
