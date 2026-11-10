import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

/// UIScene entry point — the React Native 0.88 template shape.
///
/// Apps built with the iOS 27 SDK must adopt the scene life cycle or UIKit refuses
/// to launch them. The scene, not the app delegate, owns the window and starts
/// React Native (`startReactNative(…connectionOptions:)`), and forwards URL /
/// user-activity callbacks to `RCTLinkingManager` so `Linking` keeps working.
/// Since 2.8 the widgets, Control Center controls and App Shortcuts open zero
/// with `zero://` links (add, money/add, quick; see src/navigation/linking.ts).
/// A cold start delivers the link through `connectionOptions` (read by
/// `startReactNative`), a warm one through `openURLContexts` below. The Home
/// Screen quick actions (long-press the icon, ZeroQuickActions) carry the same
/// zero://quick links: a cold start hands the link to React Native as the
/// launch URL, a warm one through `performActionFor` below.
class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)

    #if DEBUG
    let devMenuConfiguration = RCTDevMenuConfiguration(
      devMenuEnabled: true,
      shakeGestureEnabled: true,
      keyboardShortcutsEnabled: true
    )
    reactNativeFactory?.devMenuConfiguration = devMenuConfiguration
    #endif

    if let item = connectionOptions.shortcutItem, let url = ZeroQuickActions.url(of: item) {
      // What `connectionOptions` gives React Native for a link (its launch URL,
      // read by Linking.getInitialURL); a quick action is not a URL context.
      reactNativeFactory?.startReactNative(
        withModuleName: "zero",
        in: window,
        launchOptions: [UIApplication.LaunchOptionsKey.url: url]
      )
    } else {
      reactNativeFactory?.startReactNative(
        withModuleName: "zero",
        in: window,
        connectionOptions: connectionOptions
      )
    }
    // The menu as the stored snapshot has it (an update or a restore can leave it stale).
    ZeroQuickActions.publish(SharedStore.snapshot())
  }

  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let url = ZeroQuickActions.url(of: shortcutItem) else {
      completionHandler(false)
      return
    }
    // Through openURLContexts above, like a widget link: in a scene app
    // RCTLinkingManager's application(_:open:options:) returns false and
    // forwards nothing (found on the simulator, 2026-11-09).
    UIApplication.shared.open(url, options: [:], completionHandler: completionHandler)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
