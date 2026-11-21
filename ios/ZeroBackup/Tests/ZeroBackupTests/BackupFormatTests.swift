import Foundation
import XCTest

@testable import ZeroBackup

/// The encrypted backup format, iOS side (3.0, plan P10), against the vectors
/// Node's crypto wrote (contracts/backup-format.json; Android reads the same
/// file): every case opens, every reject is refused with the same answer, and
/// a file this side writes carries the reference header and opens again.
final class BackupFormatTests: XCTestCase {
  struct Case: Decodable {
    let name, passphrase, openWith, saltHex, nonceHex, plaintext, keyHex, headerHex, fileBase64: String
    let iterations: Int
    let writtenAtMs: UInt64
  }

  struct Reject: Decodable {
    let name, passphrase, error, fileBase64: String
  }

  struct Contract: Decodable {
    let cases: [Case]
    let rejects: [Reject]
  }

  /// The repository root: this file is ios/ZeroBackup/Tests/ZeroBackupTests/BackupFormatTests.swift.
  static let contract: Contract = {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { url.deleteLastPathComponent() }
    let data = try? Data(contentsOf: url.appendingPathComponent("contracts/backup-format.json"))
    // A missing or unreadable contract fails every test that reads it, by name.
    return (try? JSONDecoder().decode(Contract.self, from: data ?? Data())) ?? Contract(cases: [], rejects: [])
  }()

  func hex(_ value: String) -> Data {
    var out = Data()
    var index = value.startIndex
    while index < value.endIndex {
      let next = value.index(index, offsetBy: 2)
      out.append(UInt8(value[index..<next], radix: 16) ?? 0)
      index = next
    }
    return out
  }

  func testTheContractIsThere() {
    XCTAssertEqual(Self.contract.cases.count, 4)
    XCTAssertEqual(Self.contract.rejects.count, 9)
  }

  func testDerivesTheReferenceKeyForEveryCase() {
    for item in Self.contract.cases {
      let key = BackupFormat.deriveKey(passphrase: item.openWith, salt: hex(item.saltHex), iterations: item.iterations)
      XCTAssertEqual(key, hex(item.keyHex), item.name)
    }
  }

  func testOpensEveryFileTheReferenceWrote() throws {
    for item in Self.contract.cases {
      let file = try XCTUnwrap(Data(base64Encoded: item.fileBase64))
      let text = String(decoding: try BackupFormat.open(file, passphrase: item.openWith), as: UTF8.self)
      XCTAssertEqual(text, item.plaintext, item.name)
    }
  }

  func testRefusesEveryRejectWithTheReferencesAnswer() throws {
    for reject in Self.contract.rejects {
      let file = try XCTUnwrap(Data(base64Encoded: reject.fileBase64))
      XCTAssertThrowsError(try BackupFormat.open(file, passphrase: reject.passphrase), reject.name) { error in
        XCTAssertEqual((error as? BackupFormatError)?.code, reject.error, reject.name)
      }
    }
  }

  func testWritesTheReferenceHeaderAndWhatItWritesOpensAgain() throws {
    for item in Self.contract.cases {
      let file = try BackupFormat.seal(
        Data(item.plaintext.utf8), key: hex(item.keyHex), salt: hex(item.saltHex), iterations: item.iterations,
        writtenAtMs: item.writtenAtMs, nonce: hex(item.nonceHex))
      XCTAssertEqual(file.prefix(BackupFormat.headerBytes), hex(item.headerHex), item.name)
      XCTAssertEqual(String(decoding: try BackupFormat.open(file, passphrase: item.passphrase), as: UTF8.self), item.plaintext)
      XCTAssertEqual(BackupFormat.writtenAtMs(file), item.writtenAtMs)
    }
  }

  func testEachFileGetsItsOwnNonce() throws {
    let key = Data(count: BackupFormat.keyBytes)
    let salt = BackupFormat.randomSalt()
    let a = try BackupFormat.seal(Data("{}".utf8), key: key, salt: salt, iterations: 1_000, writtenAtMs: 0)
    let b = try BackupFormat.seal(Data("{}".utf8), key: key, salt: salt, iterations: 1_000, writtenAtMs: 0)
    XCTAssertNotEqual(a[38..<50], b[38..<50])
    XCTAssertNil(BackupFormat.writtenAtMs(Data("{}".utf8)))
  }

  func testTheFolderKeepsTheNewestDaysAndNothingElseIsTouched() {
    let names = [
      "zero-backup-2026-11-09.zbak", "zero-backup-2026-11-11.zbak", "zero-backup-2026-11-10.zbak",
      "zero-backup-2026-11-08.partial", "zero-backup-2026-11-07 (1).partial", "zero-backup-2026-11-06.replaced",
      "zero-backup-2026-11-11 (1).zbak", "holiday.jpg", "zero_v6_20261101.json",
    ]
    XCTAssertEqual(
      BackupFiles.toDelete(names, keep: 2),
      [
        "zero-backup-2026-11-09.zbak", "zero-backup-2026-11-08.partial", "zero-backup-2026-11-07 (1).partial",
        "zero-backup-2026-11-06.replaced",
      ])
    XCTAssertEqual(BackupFiles.toDelete(names, keep: 14).count, 3)
    XCTAssertEqual(BackupFiles.toDelete(names, keep: 0).filter(BackupFiles.isBackup).count, 2)
    XCTAssertEqual(BackupFiles.fileName(day: "2026-11-11"), "zero-backup-2026-11-11.zbak")
    XCTAssertNil(BackupFiles.fileName(day: "../../x"))
  }
}
