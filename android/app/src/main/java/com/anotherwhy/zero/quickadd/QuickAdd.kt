package com.anotherwhy.zero.quickadd

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Every way into the quick-add sheet builds its intent here: the widget's
 * "+", "Money in" and category chips, the Quick Settings tile and the launcher
 * shortcuts. Explicit and not exported: no other app can open it.
 */
object QuickAdd {
  const val EXTRA_KIND = "kind"
  const val EXTRA_CATEGORY = "categoryId"
  /** "Add again": the sheet opens filled in (amount as typed, e.g. "20", and the title). */
  const val EXTRA_AMOUNT = "amount"
  const val EXTRA_TITLE = "title"
  const val KIND_EXPENSE = "expense"
  const val KIND_INCOME = "income"

  /**
   * A fresh sheet each time (NEW_TASK + CLEAR_TASK in its own task): the
   * initial props always match what was tapped. The data URI only makes each
   * chip's intent distinct; nothing reads it.
   */
  fun intent(
      context: Context,
      kind: String = KIND_EXPENSE,
      categoryId: String = "",
      amount: String = "",
      title: String = "",
  ): Intent =
      Intent(context, QuickAddActivity::class.java)
          .setAction(Intent.ACTION_VIEW)
          .setData(Uri.parse("zero-quick://$kind/$categoryId?again=${Uri.encode(amount)}"))
          .putExtra(EXTRA_KIND, kind)
          .putExtra(EXTRA_CATEGORY, categoryId)
          .putExtra(EXTRA_AMOUNT, amount)
          .putExtra(EXTRA_TITLE, title)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)

  fun pendingIntent(
      context: Context,
      requestCode: Int,
      kind: String = KIND_EXPENSE,
      categoryId: String = "",
      amount: String = "",
      title: String = "",
  ): PendingIntent =
      PendingIntent.getActivity(
          context,
          requestCode,
          intent(context, kind, categoryId, amount, title),
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
}
