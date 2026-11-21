package com.anotherwhy.zero.reports

import org.json.JSONArray
import org.json.JSONObject

/**
 * A report as the app wrote it (src/pro/reportPdf.ts, `ReportDoc`): every
 * word and figure is final. Parsing is strict about shape and forgiving
 * about nothing else: a block of an unknown type is an error, so a report
 * can never silently lose a section.
 */
internal data class ReportDoc(
    val title: String,
    val subtitle: String,
    val footer: String,
    val rtl: Boolean,
    val blocks: List<Block>,
) {
  sealed interface Block

  data class Heading(val text: String) : Block

  data class Text(val text: String) : Block

  data class Stats(val items: List<Pair<String, String>>) : Block

  data class Column(val title: String, val end: Boolean, val weight: Double)

  data class Table(val columns: List<Column>, val rows: List<List<String>>, val total: List<String>?) : Block

  data class Bar(val label: String, val value: String, val fraction: Double)

  data class Bars(val rows: List<Bar>) : Block

  companion object {
    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map(::getJSONObject)

    private fun JSONArray.strings(): List<String> = (0 until length()).map(::getString)

    fun parse(json: String): ReportDoc {
      val o = JSONObject(json)
      return ReportDoc(
          title = o.getString("title"),
          subtitle = o.getString("subtitle"),
          footer = o.getString("footer"),
          rtl = o.optString("direction") == "rtl",
          blocks = o.getJSONArray("blocks").objects().map(::block),
      )
    }

    private fun block(o: JSONObject): Block =
        when (val type = o.getString("type")) {
          "heading" -> Heading(o.getString("text"))
          "text" -> Text(o.getString("text"))
          "stats" -> Stats(o.getJSONArray("items").objects().map { it.getString("label") to it.getString("value") })
          "table" -> {
            val columns =
                o.getJSONArray("columns").objects().map {
                  Column(it.getString("title"), it.getString("align") == "end", it.getDouble("weight").coerceAtLeast(0.1))
                }
            val rows = o.getJSONArray("rows").let { rows -> (0 until rows.length()).map { rows.getJSONArray(it).strings() } }
            Table(columns, rows, o.optJSONArray("total")?.strings())
          }
          "bars" ->
              Bars(
                  o.getJSONArray("rows").objects().map {
                    Bar(it.getString("label"), it.getString("value"), it.getDouble("fraction").coerceIn(0.0, 1.0))
                  })
          else -> throw IllegalArgumentException("unknown report block \"$type\"")
        }
  }
}
