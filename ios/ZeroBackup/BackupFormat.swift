import CommonCrypto
import Compression
import CryptoKit
import Foundation

/// Why a file could not be opened; `code` is what JS receives (src/data/backup/vault.ts).
public enum BackupFormatError: Error, Equatable {
  case notBackup, newerFormat, wrongPassphrase, damaged

  public var code: String {
    switch self {
    case .notBackup: return "notBackup"
    case .newerFormat: return "newerFormat"
    case .wrongPassphrase: return "wrongPassphrase"
    case .damaged: return "damaged"
    }
  }
}

/// The encrypted backup file (3.0, plan P10), exactly as docs/BACKUP_FORMAT.md
/// describes it: compressed JSON sealed with AES-256-GCM (CryptoKit) under a
/// key derived with PBKDF2-HMAC-SHA256 (CommonCrypto), the 50-byte header
/// authenticated with it. Tested against contracts/backup-format.json, which
/// the Android side reads too. Pure: Foundation and the system's crypto only.
public enum BackupFormat {
  static let magic = Data("ZEROBAK".utf8)
  static let version: UInt8 = 1
  static let kdfPBKDF2SHA256: UInt8 = 1
  static let compressionRawDeflate: UInt8 = 1
  public static let headerBytes = 50
  static let tagBytes = 16
  public static let saltBytes = 16
  public static let nonceBytes = 12
  public static let keyBytes = 32
  /// What zero writes: OWASP's current figure for PBKDF2-HMAC-SHA256.
  public static let iterations = 600_000
  static let minIterations = 1_000
  static let maxIterations = 10_000_000
  static let maxInflatedBytes = 256 * 1024 * 1024

  public static func randomBytes(_ count: Int) -> Data {
    var bytes = [UInt8](repeating: 0, count: count)
    // SecRandomCopyBytes fails only without a system random source; there is no fallback to offer.
    precondition(SecRandomCopyBytes(kSecRandomDefault, count, &bytes) == errSecSuccess)
    return Data(bytes)
  }

  public static func randomSalt() -> Data { randomBytes(saltBytes) }

  /// PBKDF2-HMAC-SHA256 over the UTF-8 of the NFC passphrase, 32 bytes.
  public static func deriveKey(passphrase: String, salt: Data, iterations: Int) -> Data {
    let password = Array(passphrase.precomposedStringWithCanonicalMapping.utf8).map { CChar(bitPattern: $0) }
    var out = [UInt8](repeating: 0, count: keyBytes)
    let status = salt.withUnsafeBytes { (saltBytes: UnsafeRawBufferPointer) in
      CCKeyDerivationPBKDF(
        CCPBKDFAlgorithm(kCCPBKDF2), password, password.count,
        saltBytes.bindMemory(to: UInt8.self).baseAddress, salt.count,
        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations), &out, out.count)
    }
    // Fails only for parameters this file never passes (a zero-length output, an unknown PRF).
    precondition(status == kCCSuccess)
    return Data(out)
  }

  static func header(salt: Data, iterations: Int, writtenAtMs: UInt64, nonce: Data) -> Data {
    var out = magic
    out.append(version)
    out.append(kdfPBKDF2SHA256)
    out.append(contentsOf: withUnsafeBytes(of: UInt32(iterations).bigEndian, Array.init))
    out.append(salt)
    out.append(compressionRawDeflate)
    out.append(contentsOf: withUnsafeBytes(of: writtenAtMs.bigEndian, Array.init))
    out.append(nonce)
    return out
  }

  /// A file: `plaintext` compressed and sealed under `key`, whose salt and iterations the header names.
  public static func seal(
    _ plaintext: Data, key: Data, salt: Data, iterations: Int, writtenAtMs: UInt64,
    nonce: Data = randomBytes(nonceBytes)
  ) throws -> Data {
    precondition(key.count == keyBytes && salt.count == saltBytes && nonce.count == nonceBytes)
    let head = header(salt: salt, iterations: iterations, writtenAtMs: writtenAtMs, nonce: nonce)
    let box = try AES.GCM.seal(
      try process(plaintext, COMPRESSION_STREAM_ENCODE, limit: Int.max),
      using: SymmetricKey(data: key), nonce: try AES.GCM.Nonce(data: nonce), authenticating: head)
    return head + box.ciphertext + box.tag
  }

  /// The JSON inside a file (the order of docs/BACKUP_FORMAT.md "Reading").
  public static func open(_ input: Data, passphrase: String) throws -> Data {
    let file = Data(input)  // indices from 0, whatever slice came in
    guard file.count >= headerBytes + tagBytes, file.prefix(magic.count) == magic else {
      throw BackupFormatError.notBackup
    }
    guard file[7] == version, file[8] == kdfPBKDF2SHA256, file[29] == compressionRawDeflate else {
      throw BackupFormatError.newerFormat
    }
    let iterations = file[9..<13].reduce(0) { ($0 << 8) | Int($1) }
    guard (minIterations...maxIterations).contains(iterations) else {
      throw BackupFormatError.notBackup
    }
    let key = deriveKey(passphrase: passphrase, salt: file[13..<29], iterations: iterations)
    let compressed: Data
    do {
      let box = try AES.GCM.SealedBox(
        nonce: AES.GCM.Nonce(data: file[38..<50]),
        ciphertext: file[headerBytes..<(file.count - tagBytes)],
        tag: file[(file.count - tagBytes)...])
      compressed = try AES.GCM.open(box, using: SymmetricKey(data: key), authenticating: file[0..<headerBytes])
    } catch {
      throw BackupFormatError.wrongPassphrase
    }
    return try process(compressed, COMPRESSION_STREAM_DECODE, limit: maxInflatedBytes)
  }

  /// When the file says it was written; nil when the header is not a zero backup's.
  public static func writtenAtMs(_ input: Data) -> UInt64? {
    let file = Data(input)
    guard file.count >= headerBytes, file.prefix(magic.count) == magic else { return nil }
    return file[30..<38].reduce(0) { ($0 << 8) | UInt64($1) }
  }

  /// Raw DEFLATE both ways (COMPRESSION_ZLIB is RFC 1951 with no header, as Android's `Deflater(nowrap)`).
  static func process(_ input: Data, _ operation: compression_stream_operation, limit: Int) throws -> Data {
    let bufferSize = 64 * 1024
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
    defer { buffer.deallocate() }
    let stream = UnsafeMutablePointer<compression_stream>.allocate(capacity: 1)
    defer { stream.deallocate() }
    guard compression_stream_init(stream, operation, COMPRESSION_ZLIB) == COMPRESSION_STATUS_OK else {
      throw BackupFormatError.damaged
    }
    defer { compression_stream_destroy(stream) }
    var out = Data()
    try input.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
      stream.pointee.src_ptr = UnsafePointer(raw.bindMemory(to: UInt8.self).baseAddress ?? UnsafePointer(buffer))
      stream.pointee.src_size = input.count
      let flags = Int32(COMPRESSION_STREAM_FINALIZE.rawValue)
      while true {
        stream.pointee.dst_ptr = buffer
        stream.pointee.dst_size = bufferSize
        let status = compression_stream_process(stream, flags)
        let produced = bufferSize - stream.pointee.dst_size
        out.append(buffer, count: produced)
        guard out.count <= limit else { throw BackupFormatError.damaged }
        switch status {
        case COMPRESSION_STATUS_END:
          return
        case COMPRESSION_STATUS_OK where produced > 0 || stream.pointee.src_size > 0:
          continue
        default:
          // An error, or no progress with nothing left to read: the stream ended early.
          throw BackupFormatError.damaged
        }
      }
    }
    return out
  }
}

/// Which files in the backup folder are zero's, and which to delete after a
/// write (docs/BACKUP_FORMAT.md, "Files in the folder"); Android's BackupFiles.kt.
public enum BackupFiles {
  static func matches(_ name: String, _ suffix: String) -> Bool {
    guard name.hasPrefix("zero-backup-"), name.hasSuffix(suffix) else { return false }
    return isDay(String(name.dropFirst("zero-backup-".count).dropLast(suffix.count)))
  }

  static func isDay(_ day: String) -> Bool {
    let parts = day.split(separator: "-", omittingEmptySubsequences: false)
    return parts.count == 3 && [4, 2, 2] == parts.map(\.count)
      && parts.allSatisfy { $0.allSatisfy { $0.isASCII && $0.isNumber } }
  }

  public static func fileName(day: String) -> String? { isDay(day) ? "zero-backup-\(day).zbak" : nil }

  public static func isBackup(_ name: String) -> Bool { matches(name, ".zbak") }

  /// What an interrupted write can leave: a partial or a set-aside old file, " (1)" copies included.
  static func isLeftover(_ name: String) -> Bool {
    [".partial", ".replaced"].contains { suffix in
      guard name.hasSuffix(suffix) else { return false }
      let stem = String(name.dropLast(suffix.count))
      let plain = stem.replacingOccurrences(of: #" \(\d+\)$"#, with: "", options: .regularExpression)
      return matches(plain + suffix, suffix)
    }
  }

  /// Every backup but the newest `keep` (at least one stays), and anything an interrupted write left.
  public static func toDelete(_ names: [String], keep: Int) -> [String] {
    let backups = names.filter(isBackup).sorted(by: >)
    return Array(backups.dropFirst(max(1, keep))) + names.filter(isLeftover)
  }
}
