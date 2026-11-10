package com.anotherwhy.zero.bridge

import android.content.Intent
import android.net.Uri
import com.anotherwhy.zero.MainActivity
import com.anotherwhy.zero.quickadd.QuickAddActivity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

/**
 * The quick-add sheet's window (Android only; iOS has no such module, so the
 * JS side sees null there): close it, fade its dim as the card leaves, or
 * hand over to the full app (audit 2026-11-08 §6.2).
 */
class QuickAddWindowModule(context: ReactApplicationContext) : NativeQuickAddWindowSpec(context) {

  override fun closeQuickAdd() {
    UiThreadUtil.runOnUiThread { (reactApplicationContext.currentActivity as? QuickAddActivity)?.finish() }
  }

  override fun fadeQuickAddScrim(durationMs: Double) {
    UiThreadUtil.runOnUiThread {
      (reactApplicationContext.currentActivity as? QuickAddActivity)?.fadeScrim(durationMs.toLong())
    }
  }

  override fun openInApp(url: String) {
    UiThreadUtil.runOnUiThread {
      val activity = reactApplicationContext.currentActivity
      val app = reactApplicationContext.applicationContext
      val intent =
          Intent(Intent.ACTION_VIEW, Uri.parse(url), app, MainActivity::class.java)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (activity ?: app).startActivity(intent)
      if (activity is QuickAddActivity) activity.finish()
    }
  }
}
