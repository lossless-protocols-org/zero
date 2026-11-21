import Foundation
import Security
import UIKit
import UniformTypeIdentifiers

/// What the JS bridge (ios/zero/Backup/ZeroBackup.mm) calls (3.0, plan P10):
/// the automatic backup's folder, key and files on iOS. Every call answers
/// through its completion block exactly once, and none throws.
///
/// - The folder is one the user picks with the system's document picker, On My
///   iPhone or iCloud Drive. zero keeps a bookmark to it (Apple, "Providing
///   access to directories"), opens access only while it works, and reads and
///   writes through NSFileCoordinator. iOS's Files syncs an iCloud folder; zero
///   makes no network call. A folder outside zero's container outlives zero.
/// - The key is derived from the passphrase and kept in the Keychain,
///   AfterFirstUnlockThisDeviceOnly: it never leaves this phone, and a backup
///   can be written while the phone is locked after its first unlock. The
///   passphrase is not kept.
/// - Work runs on one serial queue, so two backups never write at once.
@objc(ZeroBackupStore)
public final class ZeroBackupStore: NSObject {
  private static let queue = DispatchQueue(label: "com.lossless.zero.backup")
  private static let keychainService = "com.lossless.zero.backup"
  private static let keychainAccount = "key"

  // MARK: The folder

  private static var bookmarkURL: URL {
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return support.appendingPathComponent("zero-backup-folder.bookmark")
  }

  private static func json(_ object: [String: Any]) -> String {
    // Only strings, numbers and booleans are passed here.
    let data = (try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])) ?? Data("{}".utf8)
    return String(decoding: data, as: UTF8.self)
  }

  /// The picker's delegate, kept alive while the picker is up.
  private final class PickerDelegate: NSObject, UIDocumentPickerDelegate {
    let done: (URL?) -> Void
    init(_ done: @escaping (URL?) -> Void) { self.done = done }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
      done(urls.first)
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { done(nil) }
  }

  private static var picking: PickerDelegate?

  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    var top = scenes.flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }

  @objc public static func chooseFolder(_ completion: @escaping (String) -> Void) {
    DispatchQueue.main.async {
      guard picking == nil, let top = topViewController() else {
        completion(json(["outcome": "cancelled"]))
        return
      }
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
      let delegate = PickerDelegate { url in
        picking = nil
        guard let url else {
          completion(json(["outcome": "cancelled"]))
          return
        }
        queue.async {
          let started = url.startAccessingSecurityScopedResource()
          defer { if started { url.stopAccessingSecurityScopedResource() } }
          do {
            let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
            try FileManager.default.createDirectory(
              at: bookmarkURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try bookmark.write(to: bookmarkURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            completion(json(["outcome": "chosen"]))
          } catch {
            completion(json(["outcome": "cancelled"]))
          }
        }
      }
      picking = delegate
      picker.delegate = delegate
      picker.allowsMultipleSelection = false
      top.present(picker, animated: true)
    }
  }

  /// The folder, resolved from its bookmark (renewed when stale); nil when there is none or it cannot be reached.
  private static func resolveFolder() -> URL? {
    guard let data = try? Data(contentsOf: bookmarkURL) else { return nil }
    var stale = false
    guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale) else { return nil }
    if stale, url.startAccessingSecurityScopedResource() {
      defer { url.stopAccessingSecurityScopedResource() }
      if let renewed = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil) {
        try? renewed.write(to: bookmarkURL, options: .atomic)
      }
    }
    return url
  }

  /// The names in `folder`, read under coordination; nil when it cannot be read.
  private static func names(in folder: URL) -> [String]? {
    var result: [String]?
    var error: NSError?
    NSFileCoordinator().coordinate(readingItemAt: folder, options: [], error: &error) { url in
      result = try? FileManager.default.contentsOfDirectory(atPath: url.path)
    }
    return error == nil ? result : nil
  }

  private static func describe() -> String {
    guard FileManager.default.fileExists(atPath: bookmarkURL.path) else { return json(["state": "none"]) }
    guard let folder = resolveFolder() else { return json(["state": "lost", "volume": "device", "path": ""]) }
    let started = folder.startAccessingSecurityScopedResource()
    defer { if started { folder.stopAccessingSecurityScopedResource() } }
    let volume = (try? folder.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem) == true ? "icloud" : "device"
    guard started, let list = names(in: folder) else {
      return json(["state": "lost", "volume": volume, "path": folder.lastPathComponent])
    }
    return json([
      "state": "ok", "volume": volume, "path": folder.lastPathComponent,
      "files": list.filter(BackupFiles.isBackup).count,
    ])
  }

  @objc public static func folder(_ completion: @escaping (String) -> Void) {
    queue.async { completion(describe()) }
  }

  // MARK: The key

  private static func keychainQuery() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: keychainAccount,
    ]
  }

  private struct StoredKey: Codable {
    let key: Data
    let salt: Data
    let iterations: Int
  }

  private static func loadKey() -> StoredKey? {
    var query = keychainQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
    return try? JSONDecoder().decode(StoredKey.self, from: data)
  }

  @objc public static func setPassphrase(_ passphrase: String, completion: @escaping (String?) -> Void) {
    queue.async {
      let salt = BackupFormat.randomSalt()
      let stored = StoredKey(
        key: BackupFormat.deriveKey(passphrase: passphrase, salt: salt, iterations: BackupFormat.iterations),
        salt: salt, iterations: BackupFormat.iterations)
      guard let data = try? JSONEncoder().encode(stored) else {
        completion("the key could not be encoded")
        return
      }
      // Replaced in place: the old key is never deleted before the new one is kept.
      let attributes: [String: Any] = [
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      ]
      var status = SecItemUpdate(keychainQuery() as CFDictionary, attributes as CFDictionary)
      if status == errSecItemNotFound {
        status = SecItemAdd(keychainQuery().merging(attributes) { $1 } as CFDictionary, nil)
      }
      completion(status == errSecSuccess ? nil : "the Keychain refused the key (\(status))")
    }
  }

  // MARK: Writing and reading

  /// `completion(json, nil, nil)` on success; otherwise a code (folderLost, noKey, failed) and a description.
  @objc public static func write(
    _ text: String, day: String, keep: Int, completion: @escaping (String?, String?, String?) -> Void
  ) {
    queue.async {
      guard let stored = loadKey() else {
        completion(nil, "noKey", "no key is kept")
        return
      }
      guard let name = BackupFiles.fileName(day: day) else {
        completion(nil, "failed", "the day is not YYYY-MM-DD")
        return
      }
      let file: Data
      do {
        file = try BackupFormat.seal(
          Data(text.utf8), key: stored.key, salt: stored.salt, iterations: stored.iterations,
          writtenAtMs: UInt64(Date().timeIntervalSince1970 * 1000))
      } catch {
        completion(nil, "failed", "sealing failed: \(error)")
        return
      }
      guard let folder = resolveFolder() else {
        completion(nil, "folderLost", "the backup folder's bookmark does not resolve")
        return
      }
      guard folder.startAccessingSecurityScopedResource() else {
        completion(nil, "folderLost", "access to the backup folder was refused")
        return
      }
      defer { folder.stopAccessingSecurityScopedResource() }
      var coordinationError: NSError?
      var writeError: Error?
      NSFileCoordinator().coordinate(
        writingItemAt: folder.appendingPathComponent(name), options: .forReplacing, error: &coordinationError
      ) { url in
        do {
          // .atomic writes a temporary file beside it and renames: the name never holds half a file.
          try file.write(to: url, options: .atomic)
        } catch {
          writeError = error
        }
      }
      if let failure = coordinationError ?? writeError {
        let lost = names(in: folder) == nil
        completion(nil, lost ? "folderLost" : "failed", "the write failed: \(failure)")
        return
      }
      for old in BackupFiles.toDelete(names(in: folder) ?? [], keep: keep) {
        var error: NSError?
        NSFileCoordinator().coordinate(
          writingItemAt: folder.appendingPathComponent(old), options: .forDeleting, error: &error
        ) { url in
          // An old file that will not go is left for the next write; the backup itself is made.
          try? FileManager.default.removeItem(at: url)
        }
      }
      completion(json(["fileName": name, "bytes": file.count]), nil, nil)
    }
  }

  /// `completion(json, nil)` with the JSON inside, or `(nil, code)`.
  @objc public static func decrypt(
    _ base64: String, passphrase: String, completion: @escaping (String?, String?) -> Void
  ) {
    queue.async {
      guard let file = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
        completion(nil, "notBackup")
        return
      }
      do {
        completion(String(decoding: try BackupFormat.open(file, passphrase: passphrase), as: UTF8.self), nil)
      } catch let error as BackupFormatError {
        completion(nil, error.code)
      } catch {
        completion(nil, "damaged")
      }
    }
  }

  @objc public static func forget(_ completion: @escaping () -> Void) {
    queue.async {
      try? FileManager.default.removeItem(at: bookmarkURL)
      SecItemDelete(keychainQuery() as CFDictionary)
      completion()
    }
  }

  // MARK: Finishing on the way out

  private static var held: [Int: UIBackgroundTaskIdentifier] = [:]
  private static var lastToken = 0
  private static let heldLock = NSLock()

  /// Asks iOS for time to finish a backup the app is leaving (Apple, "Extending your app's background
  /// execution time"); 0 when none was given. Released by `releaseBackground`, or by iOS at expiry.
  @objc public static func holdBackground() -> Int {
    heldLock.lock()
    lastToken += 1
    let token = lastToken
    heldLock.unlock()
    let identifier = UIApplication.shared.beginBackgroundTask(withName: "zero backup") {
      releaseBackground(token)
    }
    guard identifier != .invalid else { return 0 }
    heldLock.lock()
    held[token] = identifier
    heldLock.unlock()
    return token
  }

  @objc public static func releaseBackground(_ token: Int) {
    heldLock.lock()
    let identifier = held.removeValue(forKey: token)
    heldLock.unlock()
    if let identifier { UIApplication.shared.endBackgroundTask(identifier) }
  }
}
