package com.anotherwhy.zero.reports

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import java.io.File
import java.io.FileOutputStream

/**
 * Draws a [ReportDoc] as an A4 PDF (3.0, plan P12) with Android's own
 * PdfDocument and StaticLayout: no web view, no library. Text is laid out by
 * the platform, so every script the phone can show (Devanagari, Arabic, CJK)
 * wraps and shapes as it does on screen, and it stays text in the file
 * (selectable, searchable), not a picture.
 *
 * One pass, top to bottom: each block is measured, moved to a new page when
 * it does not fit, then drawn. A table repeats its header on each page it
 * continues on; a row is never split. Always light, whatever the app's theme:
 * a document is for sending and printing.
 *
 * Sizes are PostScript points (1/72 inch), the PDF's own unit.
 */
internal class ReportPdf(private val doc: ReportDoc) {
  /**
   * Where pages are drawn. The app's is a PDF file; the JVM tests draw on bitmaps, because the
   * test runtime has no PDF writer, and every line of layout and drawing above it is the same.
   */
  interface Pages {
    /** Opens page [number] (from 1) and gives its canvas. */
    fun start(number: Int): Canvas

    /** Closes the page last opened. */
    fun finish()
  }

  /** Pages of a PDF file, written when [save] is called. */
  private class PdfPages : Pages {
    val pdf = PdfDocument()
    private var open: PdfDocument.Page? = null

    override fun start(number: Int): Canvas {
      val page = pdf.startPage(PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, number).create())
      open = page
      return page.canvas
    }

    override fun finish() {
      open?.let(pdf::finishPage)
      open = null
    }

    fun save(file: File) {
      file.parentFile?.mkdirs()
      FileOutputStream(file).use(pdf::writeTo)
    }
  }

  companion object {
    const val PAGE_WIDTH = 595
    const val PAGE_HEIGHT = 842
    const val MARGIN = 40f
    const val FOOTER_HEIGHT = 28f
    const val GAP = 6f
    const val INK = 0xFF1A1A1A.toInt()
    const val MUTED = 0xFF5F6368.toInt()
    const val RULE = 0xFFD9D9D6.toInt()
    const val BAR = 0xFF3D9960.toInt()
    const val TRACK = 0xFFECECE8.toInt()
  }

  private var pages: Pages? = null
  private var page: Canvas? = null
  private var pageNumber = 0
  private var y = MARGIN
  private val width = PAGE_WIDTH - 2 * MARGIN
  private val bottom = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT

  private fun paint(size: Float, color: Int = INK, bold: Boolean = false) =
      TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size
        this.color = color
        typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
      }

  private val title = paint(20f, bold = true)
  private val subtitle = paint(11f, MUTED)
  private val heading = paint(13f, bold = true)
  private val body = paint(10f)
  private val bodyBold = paint(10f, bold = true)
  private val small = paint(9f, MUTED)
  private val statValue = paint(14f, bold = true)
  private val footer = paint(8f, MUTED)
  private val line = Paint().apply { color = RULE; strokeWidth = 0.75f }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)

  private val canvas: Canvas
    get() = checkNotNull(page) { "no page open" }

  /** [text] wrapped to [width]; `end` puts it on the far side for the page's direction. */
  private fun layout(text: String, paint: TextPaint, width: Float, end: Boolean = false): StaticLayout =
      StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt().coerceAtLeast(1))
          .setAlignment(if (end) Layout.Alignment.ALIGN_OPPOSITE else Layout.Alignment.ALIGN_NORMAL)
          .setTextDirection(if (doc.rtl) TextDirectionHeuristics.RTL else TextDirectionHeuristics.LTR)
          .setIncludePad(false)
          .build()

  private fun draw(layout: StaticLayout, x: Float, top: Float) {
    canvas.save()
    canvas.translate(x, top)
    layout.draw(canvas)
    canvas.restore()
  }

  /** The left edge of a box [boxWidth] wide that starts [offset] from the page's leading edge. */
  private fun leading(offset: Float, boxWidth: Float): Float =
      if (doc.rtl) PAGE_WIDTH - MARGIN - offset - boxWidth else MARGIN + offset

  private fun newPage() {
    finishPage()
    pageNumber += 1
    page = checkNotNull(pages) { "nothing to draw on" }.start(pageNumber)
    y = MARGIN
  }

  private fun finishPage() {
    if (page == null) return
    val top = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT + 10f
    canvas.drawLine(MARGIN, top, PAGE_WIDTH - MARGIN, top, line)
    draw(layout(doc.footer, footer, width * 0.8f), leading(0f, width * 0.8f), top + 6f)
    draw(layout(pageNumber.toString(), footer, width * 0.2f, end = true), leading(width * 0.8f, width * 0.2f), top + 6f)
    pages?.finish()
    page = null
  }

  /** Moves to a new page when [height] does not fit under the cursor. */
  private fun room(height: Float) {
    if (page == null || y + height > bottom) newPage()
  }

  private fun paragraph(text: String, paint: TextPaint, above: Float = 0f, below: Float = GAP) {
    val laid = layout(text, paint, width)
    room(above + laid.height)
    y += above
    draw(laid, MARGIN, y)
    y += laid.height + below
  }

  private fun stats(block: ReportDoc.Stats) {
    val items = block.items.take(4)
    if (items.isEmpty()) return
    val cell = width / items.size
    val laid = items.map { (label, value) -> layout(label, small, cell - 8f) to layout(value, statValue, cell - 8f) }
    val height = laid.maxOf { it.first.height + 2f + it.second.height }
    room(height + GAP)
    laid.forEachIndexed { index, (label, value) ->
      val x = leading(index * cell, cell - 8f)
      draw(label, x, y)
      draw(value, x, y + label.height + 2f)
    }
    y += height + GAP * 2
  }

  private fun table(block: ReportDoc.Table) {
    if (block.columns.isEmpty()) return
    val weights = block.columns.sumOf { it.weight }.toFloat()
    val widths = block.columns.map { (it.weight / weights).toFloat() * width }
    val offsets = widths.runningFold(0f) { sum, w -> sum + w }
    fun row(cells: List<String>, paint: TextPaint): List<StaticLayout> =
        block.columns.mapIndexed { index, column ->
          layout(cells.getOrElse(index) { "" }, paint, widths[index] - 6f, column.end)
        }
    fun drawRow(cells: List<StaticLayout>, rule: Boolean) {
      val height = cells.maxOf { it.height }
      cells.forEachIndexed { index, cell -> draw(cell, leading(offsets[index] + 3f, widths[index] - 6f), y + 3f) }
      y += height + 6f
      if (rule) canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, line)
    }
    val header = row(block.columns.map { it.title }, small)
    fun drawHeader() = drawRow(header, rule = true)
    val headerHeight = header.maxOf { it.height } + 6f

    // The header and the first row stay together.
    val first = block.rows.firstOrNull()?.let { row(it, body) }
    room(headerHeight + (first?.maxOf { it.height } ?: 0) + 6f)
    drawHeader()
    for (cells in block.rows) {
      val laid = row(cells, body)
      if (y + laid.maxOf { it.height } + 6f > bottom) {
        newPage()
        drawHeader()
      }
      drawRow(laid, rule = false)
    }
    block.total?.let { total ->
      val laid = row(total, bodyBold)
      if (y + laid.maxOf { it.height } + 8f > bottom) {
        newPage()
        drawHeader()
      }
      canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, line)
      drawRow(laid, rule = false)
    }
    y += GAP
  }

  private fun bars(block: ReportDoc.Bars) {
    val labelWidth = width * 0.34f
    val valueWidth = width * 0.22f
    val barWidth = width - labelWidth - valueWidth - 16f
    for (bar in block.rows) {
      val label = layout(bar.label, body, labelWidth)
      val value = layout(bar.value, body, valueWidth, end = true)
      val height = maxOf(label.height, value.height).toFloat()
      room(height + 5f)
      draw(label, leading(0f, labelWidth), y)
      draw(value, leading(width - valueWidth, valueWidth), y)
      val left = leading(labelWidth + 8f, barWidth)
      val top = y + height / 2 - 3f
      fill.color = TRACK
      canvas.drawRoundRect(left, top, left + barWidth, top + 6f, 3f, 3f, fill)
      val filled = barWidth * bar.fraction.toFloat()
      if (filled > 0f) {
        fill.color = BAR
        // The bar grows from the page's leading edge.
        val from = if (doc.rtl) left + barWidth - filled else left
        canvas.drawRoundRect(from, top, from + filled, top + 6f, 3f, 3f, fill)
      }
      y += height + 5f
    }
    y += GAP
  }

  /** Draws every block onto [target]; returns how many pages it took. */
  fun drawOn(target: Pages): Int {
    pages = target
    newPage()
    paragraph(doc.title, title, below = 2f)
    paragraph(doc.subtitle, subtitle, below = 10f)
    canvas.drawLine(MARGIN, y, PAGE_WIDTH - MARGIN, y, line)
    y += 10f
    for (block in doc.blocks) {
      when (block) {
        is ReportDoc.Heading -> {
          // A heading never ends a page: it keeps room for a few lines under it.
          room(heading.textSize + 60f)
          paragraph(block.text, heading, above = 8f)
        }
        is ReportDoc.Text -> paragraph(block.text, body)
        is ReportDoc.Stats -> stats(block)
        is ReportDoc.Table -> table(block)
        is ReportDoc.Bars -> bars(block)
      }
    }
    finishPage()
    return pageNumber
  }

  /** Draws the report as a PDF in [file]; returns how many pages it took. */
  fun writeTo(file: File): Int {
    val target = PdfPages()
    try {
      val count = drawOn(target)
      target.save(file)
      return count
    } finally {
      target.pdf.close()
    }
  }
}
