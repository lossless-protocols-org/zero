package com.anotherwhy.zero.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** A reminder's alarm went off: show it. Not exported; only zero's own alarms reach it. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(Reminders.EXTRA_ID) ?: return
    Reminders.post(context, id)
  }
}
