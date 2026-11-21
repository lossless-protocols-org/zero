package com.anotherwhy.zero.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Alarms do not survive a restart (or an update of the app): arms the stored
 * reminders again, without starting JS. Listens for the system's own
 * broadcasts only (BOOT_COMPLETED, MY_PACKAGE_REPLACED).
 */
class RearmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Reminders.rearm(context)
    }
  }
}
