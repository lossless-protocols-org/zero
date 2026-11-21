package com.anotherwhy.zero.bridge

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.anotherwhy.zero.reminders.Reminder
import com.anotherwhy.zero.reminders.Reminders
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import org.json.JSONException

/**
 * NativeReminders (3.0, plan P9): the one call into reminders from JS
 * (src/pro/reminders.ts). Asking for the permission is JS's own
 * PermissionsAndroid on Android, so `requestPermission` only answers.
 */
class RemindersModule(context: ReactApplicationContext) : NativeRemindersSpec(context) {

  private fun state(): String {
    val app = reactApplicationContext
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED) {
      // Not granted yet: whether it was asked is JS's to know (it asks once, on a rule's first reminder).
      return "undetermined"
    }
    return if (NotificationManagerCompat.from(app).areNotificationsEnabled()) "granted" else "denied"
  }

  override fun permission(promise: Promise) = promise.resolve(state())

  override fun requestPermission(promise: Promise) = promise.resolve(state())

  override fun replaceAll(json: String, promise: Promise) {
    try {
      Reminders.replaceAll(reactApplicationContext.applicationContext, Reminder.listFrom(json))
      promise.resolve(null)
    } catch (e: JSONException) {
      promise.reject("reminders", "replaceAll takes a JSON array", e)
    }
  }
}
