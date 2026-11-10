package com.anotherwhy.zero.bridge

import com.anotherwhy.zero.quickadd.LauncherShortcuts
import com.anotherwhy.zero.widget.WidgetPreview
import com.anotherwhy.zero.widget.WidgetStore
import com.anotherwhy.zero.widget.ZeroWidgetProvider
import com.facebook.react.bridge.ReactApplicationContext

/**
 * The app's one call into the home-screen widget (src/features/widgets/bridge.ts
 * is the only caller): store the snapshot, redraw placed widgets, and keep the
 * picker preview and the launcher shortcuts current. The widget itself lives in
 * `widget/`; this is only the TurboModule (audit 2026-11-08 §6.2).
 */
class WidgetBridgeModule(context: ReactApplicationContext) : NativeWidgetBridgeSpec(context) {

  override fun writeSnapshot(json: String) {
    val app = reactApplicationContext.applicationContext
    // Widgets redraw only when what they show changed. The picker preview and
    // the launcher shortcuts are checked every time against what the system
    // last accepted (their own signatures), so a refused or rate-limited
    // attempt, or a new preview format, is retried on the next write.
    if (WidgetStore.write(app, json)) ZeroWidgetProvider.updateAll(app)
    val snapshot = WidgetStore.read(app) ?: return
    if (snapshot.ready) WidgetPreview.publish(app, snapshot)
    LauncherShortcuts.publish(app, if (snapshot.ready) snapshot.quick else emptyList(), snapshot.last.takeIf { snapshot.ready })
  }
}
