package com.anotherwhy.zero.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log

/**
 * The picker preview the app generates, here in the user's own currency and
 * language with made-up figures. Android 16+ only: on Android 15 the Moto
 * launcher draws a generated preview clipped to about one row (seen
 * 2026-11-06) while it draws previewLayout correctly, so there any generated
 * preview is removed and the static one stands. The system allows only a
 * few calls an hour, so each is made only when its signature changes and
 * the signature is kept only once the system has taken it.
 */
internal object WidgetPreview {
  private const val TAG = "ZeroWidget"
  /** 2: the generated preview became a size map (the Moto launcher draws it at about one row). */
  private const val PREVIEW_FORMAT = 2
  /** The Android 15 signature: no generated preview (previewLayout stands). */
  private const val PREVIEW_REMOVED = "removed"

  fun publish(context: Context, snapshot: WidgetSnapshot) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
    val signature =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
          // PREVIEW_FORMAT changes when the preview's own shape does, so it is sent again once.
          listOf(PREVIEW_FORMAT, snapshot.preview, snapshot.labels.copy(summary = ""), snapshot.locale).toString()
        } else {
          PREVIEW_REMOVED
        }
    if (WidgetStore.signature(context, WidgetStore.KEY_PREVIEW) == signature) return
    try {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val provider = ComponentName(context, ZeroWidgetProvider::class.java)
      val category = AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN
      if (signature == PREVIEW_REMOVED) {
        manager.removeWidgetPreview(provider, category)
        WidgetStore.setSignature(context, WidgetStore.KEY_PREVIEW, signature)
        return
      }
      val accepted = manager.setWidgetPreview(provider, category, WidgetRenderer.preview(context, snapshot))
      // Refused means rate-limited (a few an hour): kept unsigned, retried on a later write.
      Log.i(TAG, if (accepted) "widget preview published" else "widget preview refused (rate limit), will retry")
      if (accepted) WidgetStore.setSignature(context, WidgetStore.KEY_PREVIEW, signature)
    } catch (e: RuntimeException) {
      Log.w(TAG, "widget preview not published", e)
    } catch (e: LinkageError) {
      // A build without generated previews; previewLayout stands.
      Log.w(TAG, "generated previews not supported", e)
    }
  }
}
