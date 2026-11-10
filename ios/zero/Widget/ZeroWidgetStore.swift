import Foundation
import UIKit
import WidgetKit
import os

/// What the JS bridge (ZeroWidgetBridge.mm) calls (2.8): store the snapshot
/// the app writes and reload the widget when it says something new; hand the
/// queue of entries made outside the app to the app and drop the saved ones.
@objc(ZeroWidgetStore)
public final class ZeroWidgetStore: NSObject {
  /// Diagnostics only: what happened, never the figures.
  private static let log = Logger(subsystem: "com.anotherwhy.zero", category: "widget")

  @objc public static func writeSnapshot(_ json: String) {
    let categoriesBefore = SharedStore.snapshot()?.categories
    guard SharedStore.writeSnapshot(json) else {
      log.debug("snapshot unchanged")
      return
    }
    log.info("snapshot written (\(json.count) chars), widgets reloaded")
    WidgetCenter.shared.reloadAllTimelines()
    ZeroQuickActions.publish(SharedStore.snapshot())
    // Siri learns "Add a Food expense" phrases from the category list.
    if #available(iOS 17.4, *), SharedStore.snapshot()?.categories != categoriesBefore {
      ZeroShortcuts.updateAppShortcutParameters()
    }
  }

  @objc public static func readPendingEntries() -> String {
    SharedStore.pendingJSON()
  }

  @objc public static func removePendingEntries(_ ids: [String]) {
    SharedStore.removePending(ids: ids)
  }
}

/// Long-press zero's icon (2.8): installs the menu WidgetSnapshot.quickActions()
/// plans (shared, tested in ZeroShared), whenever the snapshot changes and at
/// launch. A tap opens its zero://quick link (SceneDelegate). App target only:
/// a widget extension cannot reach UIApplication.
enum ZeroQuickActions {
  private static let urlKey = "url"

  /// Sets the menu, on the main thread, only when it changed.
  static func publish(_ snapshot: WidgetSnapshot?) {
    DispatchQueue.main.async {
      let next = (snapshot?.quickActions() ?? []).map(item)
      let current = UIApplication.shared.shortcutItems ?? []
      if current.map(signature) != next.map(signature) {
        UIApplication.shared.shortcutItems = next
      }
    }
  }

  /// Where a tapped item goes; nil for an item this app did not make.
  static func url(of item: UIApplicationShortcutItem) -> URL? {
    guard item.type.hasPrefix(QuickAction.typePrefix),
      let value = item.userInfo?[urlKey] as? String,
      let url = URL(string: value), url.scheme == "zero"
    else { return nil }
    return url
  }

  private static func item(_ action: QuickAction) -> UIApplicationShortcutItem {
    UIApplicationShortcutItem(
      type: action.type, localizedTitle: action.title, localizedSubtitle: action.subtitle,
      icon: UIApplicationShortcutIcon(systemImageName: action.symbol),
      userInfo: [urlKey: action.url.absoluteString as NSString])
  }

  private static func signature(_ item: UIApplicationShortcutItem) -> String {
    "\(item.type)|\(item.localizedTitle)|\(item.localizedSubtitle ?? "")|\(item.userInfo?[urlKey] as? String ?? "")"
  }
}
