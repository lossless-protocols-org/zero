package com.anotherwhy.zero.widget

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONException
import org.json.JSONObject

/**
 * The widget's only storage: the last snapshot the app wrote, in the app's
 * private SharedPreferences (never backed up: allowBackup is false). With
 * amounts hidden the snapshot holds no amount at all (snapshot.ts).
 */
internal object WidgetStore {
  private const val FILE = "zero_widget"
  private const val KEY_SNAPSHOT = "snapshot"
  private const val KEY_CONTENT = "content"
  const val KEY_PREVIEW = "previewSignature"
  const val KEY_SHORTCUTS = "shortcutSignature"

  private fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun read(context: Context): WidgetSnapshot? =
      WidgetSnapshot.parse(prefs(context).getString(KEY_SNAPSHOT, null))

  /**
   * Stores [json]; false when it says nothing new (only `computedAt` moved),
   * so the app coming to the foreground does not redraw every widget.
   */
  fun write(context: Context, json: String): Boolean {
    val content =
        try {
          JSONObject(json).apply { remove("computedAt") }.toString()
        } catch (e: JSONException) {
          json
        }
    val p = prefs(context)
    if (p.getString(KEY_CONTENT, null) == content) return false
    p.edit().putString(KEY_SNAPSHOT, json).putString(KEY_CONTENT, content).apply()
    return true
  }

  /**
   * What was last accepted by a rate-limited system call (the generated
   * preview, the launcher shortcuts), so it is only called again on a change.
   */
  fun signature(context: Context, key: String): String? = prefs(context).getString(key, null)

  fun setSignature(context: Context, key: String, signature: String) {
    prefs(context).edit().putString(key, signature).apply()
  }
}
