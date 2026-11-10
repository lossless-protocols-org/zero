package com.anotherwhy.zero.widget

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import org.json.JSONException
import org.json.JSONObject

/**
 * What the widget shows, as written by src/widgets/snapshot.ts. Every string
 * is final, translated and formatted by the app; the widget only picks which
 * ones to show. A snapshot of an unknown version is not read at all: the
 * widget shows "Open zero to start" and the app writes a fresh one.
 */
internal data class WidgetSnapshot(
    val ready: Boolean,
    val locale: String,
    val monthKey: String,
    val todayKey: String,
    val monthLabel: String,
    val spentMonth: String,
    val spentToday: String,
    val zero: String,
    val budget: Budget?,
    val incomeLine: String?,
    val labels: Labels,
    val preview: Preview,
    /** Category chips for a one-tap quick add, most used first (names only). */
    val quick: List<QuickCategory> = emptyList(),
    /** "Add again": expenses entered often, most recent first (empty with amounts hidden). */
    val again: List<Again> = emptyList(),
    /** The latest expense, for "repeat my last expense" (null with amounts hidden). */
    val last: Again? = null,
) {
  data class QuickCategory(val id: String, val name: String)

  data class Again(val title: String, val categoryId: String, val amount: Double, val amountText: String)

  data class Budget(val progress: Double, val over: Boolean, val text: String)

  data class Labels(
      val today: String,
      val addExpense: String,
      val addIncome: String,
      val summary: String,
  )

  data class Preview(val spentMonth: String, val spentToday: String, val budgetText: String)

  /**
   * The snapshot as it reads at [now]. Figures belong to the day and month
   * they were computed for: once the date has moved on, today reads as zero,
   * and in a new month the month does too (with the new month's name), with
   * no budget or money-in line until the app has computed the new month.
   * Null when the date is earlier than the snapshot's.
   */
  fun asOf(now: Calendar): WidgetSnapshot? {
    if (!ready) return this
    val month = monthKeyOf(now)
    val today = dayKeyOf(now)
    if (monthKey == month && todayKey == today) return this
    // The clock went back past the day these figures belong to (a manual
    // correction): nothing here is known to be true, so the caller shows
    // "Open zero", and opening it writes the right figures.
    if (today < todayKey) return null
    if (monthKey == month) return copy(todayKey = today, spentToday = zero, labels = labels.copy(summary = ""))
    return copy(
        monthKey = month,
        todayKey = today,
        monthLabel = monthName(now, locale),
        spentMonth = zero,
        spentToday = zero,
        budget = null,
        incomeLine = null,
        labels = labels.copy(summary = ""),
    )
  }

  /** What a screen reader says for the figures. */
  fun spokenSummary(): String =
      labels.summary.ifEmpty { "$monthLabel: $spentMonth. ${labels.today}: $spentToday." }

  companion object {
    const val VERSION = 1

    fun parse(json: String?): WidgetSnapshot? {
      if (json.isNullOrEmpty()) return null
      return try {
        val o = JSONObject(json)
        if (o.optInt("v", -1) != VERSION) return null
        val labels = o.getJSONObject("labels")
        val preview = o.getJSONObject("preview")
        val budget = o.optJSONObject("budget")
        // Absent in a snapshot written before quick add existed: no chips, nothing else changes.
        val quick = o.optJSONArray("quick")
        // Absent before "add again" existed: none offered.
        val again = o.optJSONArray("again")
        val last = o.optJSONObject("last")
        WidgetSnapshot(
            ready = o.getString("state") == "ready",
            locale = o.getString("locale"),
            monthKey = o.getString("monthKey"),
            todayKey = o.getString("todayKey"),
            monthLabel = o.getString("monthLabel"),
            spentMonth = o.getString("spentMonth"),
            spentToday = o.getString("spentToday"),
            zero = o.getString("zero"),
            budget =
                budget?.let {
                  Budget(
                      progress = it.getDouble("progress").coerceIn(0.0, 1.0),
                      over = it.getBoolean("over"),
                      text = it.getString("text"),
                  )
                },
            incomeLine = if (o.isNull("incomeLine")) null else o.getString("incomeLine"),
            labels =
                Labels(
                    today = labels.getString("today"),
                    addExpense = labels.getString("addExpense"),
                    addIncome = labels.getString("addIncome"),
                    summary = labels.getString("summary"),
                ),
            preview =
                Preview(
                    spentMonth = preview.getString("spentMonth"),
                    spentToday = preview.getString("spentToday"),
                    budgetText = preview.getString("budgetText"),
                ),
            quick =
                (0 until (quick?.length() ?: 0)).mapNotNull { i ->
                  quick?.optJSONObject(i)?.let { QuickCategory(it.getString("id"), it.getString("name")) }
                },
            again =
                (0 until (again?.length() ?: 0)).mapNotNull { i ->
                  again?.optJSONObject(i)?.let {
                    Again(it.getString("title"), it.getString("categoryId"), it.getDouble("amount"), it.getString("amountText"))
                  }
                },
            last =
                last?.let {
                  Again(it.getString("title"), it.getString("categoryId"), it.getDouble("amount"), it.getString("amountText"))
                },
        )
      } catch (e: JSONException) {
        null
      }
    }

    fun monthKeyOf(c: Calendar): String =
        String.format(Locale.US, "%04d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1)

    fun dayKeyOf(c: Calendar): String =
        String.format(Locale.US, "%s-%02d", monthKeyOf(c), c.get(Calendar.DAY_OF_MONTH))

    /** The month's stand-alone name ("November"), capitalised as the app shows it. */
    fun monthName(c: Calendar, languageTag: String): String {
      val locale = Locale.forLanguageTag(languageTag)
      // Format in the calendar's own zone: the formatter's default is the device zone, which names the
      // wrong month for a moment near midnight in another zone (CI runs in UTC, the tests in Asia/Kolkata).
      val name = SimpleDateFormat("LLLL", locale).apply { timeZone = c.timeZone }.format(c.time)
      return name.replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }
    }
  }
}
