import Foundation
import os

/// The App Group zero's app, its widget and its intents share (2.8): the
/// widget snapshot the app writes, the queue of entries made outside the app
/// (Siri, Shortcuts, the Action Button, the widget's own buttons) that the app
/// saves the next time it runs (src/widgets/pendingEntries.ts), the widget
/// keypad's half-typed amount, and the last entry made outside the app (for
/// Undo). Nothing here opens zero's database.
///
/// Two processes write here: the app (its intents, its JS bridge) and the
/// widget extension (widget buttons, controls). Every read-modify-write runs
/// under one file lock in the group container, which holds across processes
/// and threads alike.
enum SharedStore {
  private static let snapshotKey = "snapshot"
  private static let contentKey = "snapshotContent"
  private static let pendingKey = "pendingEntries"
  private static let keypadKey = "keypad"
  private static let lastAddedKey = "lastAdded"

  /// A half-typed amount older than this is forgotten.
  static let keypadLifetime: TimeInterval = 180
  /// How long the widget offers Undo after an entry.
  static let undoLifetime: TimeInterval = 120

  /// The group id comes from Info.plist (`ZeroAppGroup` = group.$(ZERO_BUNDLE_ID)),
  /// so a QA build with its own bundle id has its own group.
  static var groupID: String {
    (Bundle.main.object(forInfoDictionaryKey: "ZeroAppGroup") as? String) ?? "group.com.anotherwhy.zero"
  }

  static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

  private static var lockPath: String? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
      .appendingPathComponent("zero-widget.lock").path
  }

  /// Diagnostics only: what happened, never the figures.
  private static let log = Logger(subsystem: "com.anotherwhy.zero", category: "shared-store")

  /// Runs `body` holding the group's lock (flock: per open file, so it also
  /// orders two threads of one process). Without the App Group container (a
  /// build without the entitlement) or a lock it still runs: dropping the
  /// user's entry would be worse than an unordered write, which the next
  /// snapshot write heals. It is logged, not silent (audit 2026-11-08 §6.4).
  private static func locked<T>(_ body: () -> T) -> T {
    guard let path = lockPath else {
      log.error("no App Group container: running unlocked")
      return body()
    }
    let fd = open(path, O_CREAT | O_RDWR, 0o600)
    guard fd >= 0 else {
      log.error("lock file not opened (errno \(errno)): running unlocked")
      return body()
    }
    defer { close(fd) }
    guard flock(fd, LOCK_EX) == 0 else {
      log.error("lock not taken (errno \(errno)): running unlocked")
      return body()
    }
    defer { flock(fd, LOCK_UN) }
    return body()
  }

  // MARK: Snapshot

  static func snapshotJSON() -> String? { defaults?.string(forKey: snapshotKey) }

  static func snapshot() -> WidgetSnapshot? { WidgetSnapshot.parse(snapshotJSON()) }

  /// Stores the app's snapshot with every entry still waiting in the queue
  /// added in (the app writes figures from its database, which does not have
  /// them yet). False when nothing changed (only `computedAt` moved), so the
  /// widget is not reloaded for nothing.
  @discardableResult
  static func writeSnapshot(_ json: String, now: Date = Date()) -> Bool {
    locked {
      var stored = json
      let queue = readQueue()
      if !queue.isEmpty, var snapshot = WidgetSnapshot.parse(json) {
        for entry in queue { snapshot = snapshot.applying(entry, sign: 1, now: now) }
        stored = snapshot.encoded() ?? json
      }
      let content = contentOf(stored)
      guard let defaults, defaults.string(forKey: contentKey) != content else { return false }
      defaults.set(stored, forKey: snapshotKey)
      defaults.set(content, forKey: contentKey)
      return true
    }
  }

  private static func storeSnapshot(_ snapshot: WidgetSnapshot) {
    guard let json = snapshot.encoded() else { return }
    defaults?.set(json, forKey: snapshotKey)
    defaults?.set(contentOf(json), forKey: contentKey)
  }

  private static func contentOf(_ json: String) -> String {
    guard let data = json.data(using: .utf8),
      var object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return json }
    object.removeValue(forKey: "computedAt")
    guard let out = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return json }
    return String(data: out, encoding: .utf8) ?? json
  }

  // MARK: Entries made outside the app

  static func pendingEntries() -> [PendingEntry] { locked { readQueue() } }

  static func pendingJSON() -> String {
    guard let data = try? JSONEncoder().encode(pendingEntries()) else { return "[]" }
    return String(data: data, encoding: .utf8) ?? "[]"
  }

  /// Queues `entry`, redraws the snapshot with it at once (when amounts show)
  /// and remembers it for Undo. `label` is what Undo says it takes back.
  static func enqueue(_ entry: PendingEntry, label: String, now: Date = Date()) {
    locked {
      var queue = readQueue()
      queue.append(entry)
      writeQueue(queue)
      if let snapshot = WidgetSnapshot.parse(snapshotJSON()) {
        storeSnapshot(snapshot.applying(entry, sign: 1, now: now))
      }
      write(LastAdded(id: entry.id, label: label, at: now), forKey: lastAddedKey)
    }
  }

  /// Takes back an entry the app has not saved yet: off the queue and out of
  /// the figures. Nil when it is no longer waiting (the app saved it: change
  /// it in zero).
  @discardableResult
  static func undo(id: String, now: Date = Date()) -> PendingEntry? {
    locked {
      var queue = readQueue()
      guard let index = queue.firstIndex(where: { $0.id == id }) else { return nil }
      let entry = queue.remove(at: index)
      writeQueue(queue)
      if let snapshot = WidgetSnapshot.parse(snapshotJSON()) {
        storeSnapshot(snapshot.applying(entry, sign: -1, now: now))
      }
      if read(LastAdded.self, forKey: lastAddedKey)?.id == id {
        defaults?.removeObject(forKey: lastAddedKey)
      }
      return entry
    }
  }

  static func removePending(ids: [String]) {
    let drop = Set(ids)
    locked { writeQueue(readQueue().filter { !drop.contains($0.id) }) }
  }

  /// The last entry made outside the app, while it can still be undone.
  static func lastAdded(now: Date = Date()) -> LastAdded? {
    locked {
      guard let last = read(LastAdded.self, forKey: lastAddedKey),
        readQueue().contains(where: { $0.id == last.id })
      else { return nil }
      return last.at.addingTimeInterval(undoLifetime) > now ? last : nil
    }
  }

  /// The last entry made outside the app that is still waiting, however old (for "undo" by voice).
  static func lastUndoable() -> LastAdded? {
    locked {
      guard let last = read(LastAdded.self, forKey: lastAddedKey),
        readQueue().contains(where: { $0.id == last.id })
      else { return nil }
      return last
    }
  }

  private static func readQueue() -> [PendingEntry] { read([PendingEntry].self, forKey: pendingKey) ?? [] }

  private static func writeQueue(_ queue: [PendingEntry]) { write(queue, forKey: pendingKey) }

  // MARK: The widget keypad

  /// The amount typed on the widget so far ("12.5"), "" when nothing (or it went stale).
  static func keypadText(now: Date = Date()) -> String {
    guard let state = read(KeypadState.self, forKey: keypadKey),
      state.at.addingTimeInterval(keypadLifetime) > now
    else { return "" }
    return state.text
  }

  /// When the typed amount goes stale (for the widget's timeline), or nil.
  static func keypadExpiry(now: Date = Date()) -> Date? {
    guard let state = read(KeypadState.self, forKey: keypadKey), !state.text.isEmpty else { return nil }
    let end = state.at.addingTimeInterval(keypadLifetime)
    return end > now ? end : nil
  }

  /// Applies one key ("0"–"9", ".", "back", "clear") to the typed amount.
  static func press(_ key: String, maxDecimals: Int, now: Date = Date()) {
    locked {
      let next = KeypadState.apply(key, to: keypadText(now: now), maxDecimals: maxDecimals)
      write(KeypadState(text: next, at: now), forKey: keypadKey)
    }
  }

  static func clearKeypad() { locked { defaults?.removeObject(forKey: keypadKey) } }

  // MARK: Codable storage

  private static func read<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
    guard let data = defaults?.string(forKey: key)?.data(using: .utf8) else { return nil }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .secondsSince1970
    return try? decoder.decode(type, from: data)
  }

  private static func write<T: Encodable>(_ value: T, forKey key: String) {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .secondsSince1970
    guard let data = try? encoder.encode(value) else { return }
    defaults?.set(String(data: data, encoding: .utf8), forKey: key)
  }
}

/// The last entry made outside the app, and how Undo names it ("₹120 · Food").
struct LastAdded: Codable, Equatable {
  var id: String
  var label: String
  var at: Date
}

/// The widget keypad's typed amount, as plain ASCII digits with "." for the decimal point.
struct KeypadState: Codable, Equatable {
  /// zero's amounts stay below a trillion: at most 12 whole digits.
  static let maxWholeDigits = 12

  var text: String
  var at: Date

  /// `text` after one key. Leading zeros are dropped, a second point and
  /// digits past the currency's decimals are ignored, and a currency without
  /// decimals has no point at all.
  static func apply(_ key: String, to text: String, maxDecimals: Int) -> String {
    switch key {
    case "back": return String(text.dropLast())
    case "clear": return ""
    case ".":
      guard maxDecimals > 0, !text.contains(".") else { return text }
      return (text.isEmpty ? "0" : text) + "."
    default:
      guard key.count == 1, let digit = key.first, digit.isASCII, digit.isNumber else { return text }
      if let point = text.firstIndex(of: ".") {
        return text[text.index(after: point)...].count < maxDecimals ? text + key : text
      }
      if text == "0" { return key }
      return text.count < maxWholeDigits ? text + key : text
    }
  }

  /// The typed amount as a number, nil when there is none (or it is zero).
  static func amount(_ text: String) -> Decimal? {
    guard let value = Decimal(string: text, locale: Locale(identifier: "en_US_POSIX")), value > 0 else {
      return nil
    }
    return value
  }
}
