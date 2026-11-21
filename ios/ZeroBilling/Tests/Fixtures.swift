import Foundation

/// The files every side of the billing contract reads, from the repository
/// itself (not a copy), so a change on any side fails a suite.
enum Fixtures {
  /// The repository root: this file is ios/ZeroBilling/Tests/Fixtures.swift.
  static let repo: URL = {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0..<4 { url.deleteLastPathComponent() }
    return url
  }()

  /// contracts/billing-scenarios.json, as parsed JSON.
  static func scenarios() throws -> [String: Any] {
    let data = try Data(contentsOf: repo.appendingPathComponent("contracts/billing-scenarios.json"))
    guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw NSError(domain: "Fixtures", code: 1, userInfo: [NSLocalizedDescriptionKey: "the fixture is not an object"])
    }
    return object
  }

  /// The local App Store catalogue the tests buy from.
  static let storeKitConfiguration = repo.appendingPathComponent("ios/zero/Billing/zero.storekit")

  static func json(_ text: String) throws -> NSObject {
    // JSONSerialization returns Foundation objects, all of them NSObject, which compare by value with ==.
    guard let object = try JSONSerialization.jsonObject(with: Data(text.utf8), options: [.fragmentsAllowed]) as? NSObject
    else {
      throw NSError(domain: "Fixtures", code: 2, userInfo: [NSLocalizedDescriptionKey: "not JSON: \(text)"])
    }
    return object
  }
}
