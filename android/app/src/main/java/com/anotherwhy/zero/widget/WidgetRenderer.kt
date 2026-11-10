package com.anotherwhy.zero.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.graphics.Typeface
import android.text.TextPaint
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import com.anotherwhy.zero.MainActivity
import com.anotherwhy.zero.R
import com.anotherwhy.zero.quickadd.QuickAdd
import java.util.Calendar

/**
 * Builds the widget's views from a snapshot. Responsive: on Android 12+ the
 * launcher gets every layout with the smallest size it needs and picks the
 * largest that fits, so a resize redraws with no round trip to the app; on
 * Android 11 and lower the layout is chosen from the size the launcher
 * reports (portrait width, landscape height: the smaller of each).
 */
internal object WidgetRenderer {

  /** When a layout shows the money-in line. */
  internal enum class IncomeLine {
    NEVER,
    WITHOUT_BUDGET,
    ALWAYS,
  }

  /**
   * One layout and what it holds; sizes in dp are the least it needs. One
   * XML can serve two sizes (SMALL, SMALL_TALL): the taller one fills its
   * spare height with the budget, the shorter one never risks pushing the
   * add button out of a short launcher cell.
   */
  internal enum class Layout(
      val id: Int,
      val minWidth: Float,
      val minHeight: Float,
      val today: Boolean = true,
      val addIncome: Boolean = false,
      val budget: Boolean = false,
      val incomeLine: IncomeLine = IncomeLine.NEVER,
      val addText: Boolean = false,
      val chips: Boolean = false,
      val again: Boolean = false,
  ) {
    TINY(R.layout.zero_widget_tiny, 100f, 40f, today = false),
    WIDE(R.layout.zero_widget_wide, 220f, 40f),
    SMALL(R.layout.zero_widget_small, 100f, 146f, addText = true),
    SMALL_TALL(R.layout.zero_widget_small, 100f, 196f, budget = true, addText = true),
    MEDIUM(
        R.layout.zero_widget_medium,
        220f,
        150f,
        addIncome = true,
        budget = true,
        incomeLine = IncomeLine.WITHOUT_BUDGET,
    ),
    // Same XML with room for the category chips (a 4×2 on most phones).
    MEDIUM_QUICK(
        R.layout.zero_widget_medium,
        220f,
        196f,
        addIncome = true,
        budget = true,
        incomeLine = IncomeLine.WITHOUT_BUDGET,
        chips = true,
    ),
    LARGE(
        R.layout.zero_widget_large,
        220f,
        250f,
        addIncome = true,
        budget = true,
        incomeLine = IncomeLine.ALWAYS,
        chips = true,
        again = true,
    ),
  }

  private const val REQUEST_HOME = 0
  private const val REQUEST_ADD = 1
  private const val REQUEST_INCOME = 2
  /** Chips take 10, 11, 12, 13. */
  private const val REQUEST_CHIP = 10
  private val CHIP_IDS = intArrayOf(R.id.quick_1, R.id.quick_2, R.id.quick_3, R.id.quick_4)
  private const val REQUEST_AGAIN = 20

  fun build(context: Context, options: Bundle?, stored: WidgetSnapshot?): RemoteViews {
    val snapshot = stored?.asOf(Calendar.getInstance())
    if (snapshot == null || !snapshot.ready) return setup(context)
    val width = widthDp(options)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return RemoteViews(
          Layout.entries.associate {
            SizeF(it.minWidth, it.minHeight) to bind(context, it, snapshot, widthDp = width)
          })
    }
    return bind(context, pick(options), snapshot, widthDp = width)
  }

  /**
   * The widget's narrowest width in dp (portrait; a launcher reports one size
   * per orientation on Android 12+), or 0 when the launcher has not said.
   */
  private fun widthDp(options: Bundle?): Float {
    if (options == null) return 0f
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      @Suppress("DEPRECATION") // getParcelableArrayList(String, Class) is API 33+.
      val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
      sizes?.minOfOrNull { it.width }?.let { return it }
    }
    return options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).toFloat()
  }

  /** Chip geometry in dp, from ZeroWidget.Chip and the layouts (chip row = widget − 32 dp). */
  private const val CHIP_PADDING_DP = 20f
  private const val CHIP_GAP_DP = 6f
  private const val CHIP_ROW_INSET_DP = 32f
  private const val CHIP_TEXT_SP = 13f

  /**
   * How many of the leading chips fit whole in [rowDp] at their natural width
   * (as iOS's ViewThatFits): never a chip cut to "Transpor…". At least one,
   * so a very long first name still gets its (ellipsized) chip.
   */
  internal fun chipsThatFit(textWidthsDp: List<Float>, rowDp: Float): Int {
    var used = 0f
    var count = 0
    for (text in textWidthsDp) {
      val next = used + (if (count == 0) 0f else CHIP_GAP_DP) + text + CHIP_PADDING_DP
      if (next > rowDp) break
      used = next
      count++
    }
    return maxOf(count, if (textWidthsDp.isEmpty()) 0 else 1)
  }

  /** Text widths in dp at the chip's font and the user's font scale. */
  private fun chipTextWidthsDp(context: Context, names: List<String>): List<Float> {
    val paint =
        TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
          typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
          textSize = CHIP_TEXT_SP * context.resources.configuration.fontScale
        }
    return names.map { paint.measureText(it) }
  }

  /**
   * The made-up month for the picker's generated preview (Android 15+). Sent
   * as the same size map as a placed widget: launchers draw the preview at
   * their own size (the Moto launcher at about one row, the Pixel launcher at
   * the full 4×2), and each must get the layout that fits it.
   */
  @RequiresApi(Build.VERSION_CODES.S)
  fun preview(context: Context, snapshot: WidgetSnapshot): RemoteViews {
    val sample =
        snapshot.copy(
            spentMonth = snapshot.preview.spentMonth,
            spentToday = snapshot.preview.spentToday,
            budget = WidgetSnapshot.Budget(0.62, false, snapshot.preview.budgetText),
            incomeLine = null,
            labels = snapshot.labels.copy(summary = ""),
            quick = emptyList(),
        )
    return RemoteViews(
        Layout.entries.associate {
          SizeF(it.minWidth, it.minHeight) to bind(context, it, sample, interactive = false)
        })
  }

  fun setup(context: Context): RemoteViews =
      RemoteViews(context.packageName, R.layout.zero_widget_setup).apply {
        setOnClickPendingIntent(android.R.id.background, launch(context))
      }

  private fun pick(options: Bundle?): Layout =
      layoutFor(
          options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 0,
          options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) ?: 0,
      )

  /**
   * The layout for a widget of this size (dp), by the platform's own rule for
   * a size map: the largest layout that fits, else the smallest. Android 11
   * and lower use it directly; it is also what the tests pin the table to.
   * Unknown size (0): the default 4×2.
   */
  internal fun layoutFor(widthDp: Int, heightDp: Int): Layout {
    if (widthDp <= 0 || heightDp <= 0) return Layout.MEDIUM
    return Layout.entries
        .filter { it.minWidth <= widthDp && it.minHeight <= heightDp }
        .maxByOrNull { it.minWidth * it.minHeight } ?: Layout.TINY
  }

  private fun bind(
      context: Context,
      layout: Layout,
      s: WidgetSnapshot,
      interactive: Boolean = true,
      widthDp: Float = 0f,
  ): RemoteViews =
      RemoteViews(context.packageName, layout.id).apply {
        setTextViewText(R.id.month_label, s.monthLabel)
        setTextViewText(R.id.spent_month, s.spentMonth)
        setContentDescription(R.id.figures, s.spokenSummary())
        if (layout.today) {
          setTextViewText(R.id.today_label, s.labels.today)
          setTextViewText(R.id.spent_today, s.spentToday)
        }
        setContentDescription(R.id.add_expense, s.labels.addExpense)
        if (layout.addText) setTextViewText(R.id.add_expense_text, s.labels.addExpense)
        if (layout.addIncome) setContentDescription(R.id.add_income, s.labels.addIncome)

        val budget = s.budget.takeIf { layout.budget }
        if (layout.budget) {
          setViewVisibility(R.id.budget_group, if (budget == null) View.GONE else View.VISIBLE)
          if (budget != null) {
            val shown = if (budget.over) R.id.budget_progress_over else R.id.budget_progress
            val hidden = if (budget.over) R.id.budget_progress else R.id.budget_progress_over
            setViewVisibility(shown, View.VISIBLE)
            setViewVisibility(hidden, View.GONE)
            setProgressBar(shown, BAR_MAX, (budget.progress * BAR_MAX).toInt(), false)
            val text = if (budget.over) R.id.budget_text_over else R.id.budget_text
            val other = if (budget.over) R.id.budget_text else R.id.budget_text_over
            setViewVisibility(text, View.VISIBLE)
            setViewVisibility(other, View.GONE)
            setTextViewText(text, budget.text)
          }
        }
        if (layout.incomeLine != IncomeLine.NEVER) {
          val income =
              s.incomeLine?.takeIf { layout.incomeLine == IncomeLine.ALWAYS || budget == null }
          setViewVisibility(R.id.income_line, if (income == null) View.GONE else View.VISIBLE)
          if (income != null) setTextViewText(R.id.income_line, income)
        }

        if (layout.chips) {
          val candidates = if (interactive) s.quick.take(CHIP_IDS.size) else emptyList()
          // Natural widths, as many as fit whole (unknown width: the layout's least).
          val row = (if (widthDp > 0f) widthDp else layout.minWidth) - CHIP_ROW_INSET_DP
          val fit = chipsThatFit(chipTextWidthsDp(context, candidates.map { it.name }), row)
          val chips = candidates.take(fit)
          setViewVisibility(R.id.quick_row, if (chips.isEmpty()) View.GONE else View.VISIBLE)
          CHIP_IDS.forEachIndexed { i, id ->
            val chip = chips.getOrNull(i)
            setViewVisibility(id, if (chip == null) View.GONE else View.VISIBLE)
            if (chip != null) {
              setTextViewText(id, chip.name)
              setContentDescription(id, "${s.labels.addExpense}: ${chip.name}")
              setOnClickPendingIntent(
                  id,
                  QuickAdd.pendingIntent(context, REQUEST_CHIP + i, QuickAdd.KIND_EXPENSE, chip.id),
              )
            }
          }
        }

        if (layout.again) {
          // The latest "add again" entry: the sheet opens filled in, one tap from Save.
          val again = if (interactive) s.again.firstOrNull() else null
          setViewVisibility(R.id.again_row, if (again == null) View.GONE else View.VISIBLE)
          if (again != null) {
            setTextViewText(R.id.again_title, again.title)
            setTextViewText(R.id.again_amount, again.amountText)
            setContentDescription(
                R.id.again_row, "${context.getString(R.string.widget_add_again)}: ${again.title}, ${again.amountText}")
            setOnClickPendingIntent(
                R.id.again_row,
                QuickAdd.pendingIntent(
                    context, REQUEST_AGAIN, QuickAdd.KIND_EXPENSE, again.categoryId, plainAmount(again.amount),
                    again.title),
            )
          }
        }

        if (interactive) {
          setOnClickPendingIntent(android.R.id.background, launch(context))
          // "+" and "Money in" open the quick-add sheet over the home screen, not the app.
          setOnClickPendingIntent(R.id.add_expense, QuickAdd.pendingIntent(context, REQUEST_ADD))
          if (layout.addIncome) {
            setOnClickPendingIntent(
                R.id.add_income,
                QuickAdd.pendingIntent(context, REQUEST_INCOME, QuickAdd.KIND_INCOME),
            )
          }
        }
      }

  /** An amount as someone would type it: "20", "12.5" (never "20.0" or an exponent). */
  internal fun plainAmount(amount: Double): String =
      java.math.BigDecimal.valueOf(amount).stripTrailingZeros().toPlainString()

  /**
   * The widget body opens zero exactly as its launcher icon does: back to
   * whatever was on screen (a half-typed expense survives), Home on a fresh start.
   */
  private fun launch(context: Context): PendingIntent =
      PendingIntent.getActivity(
          context,
          REQUEST_HOME,
          Intent(Intent.ACTION_MAIN)
              .addCategory(Intent.CATEGORY_LAUNCHER)
              .setClass(context, MainActivity::class.java)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED),
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

  private const val BAR_MAX = 1000
}
