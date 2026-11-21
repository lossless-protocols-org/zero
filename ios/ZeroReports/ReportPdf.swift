import Foundation
import UIKit

/// A report as the app wrote it (src/pro/reportPdf.ts, `ReportDoc`): every
/// word and figure is final. A block of an unknown type fails the decode, so
/// a report can never silently lose a section (as Android's ReportDoc.kt).
public struct ReportDoc: Decodable {
  public struct Stat: Decodable {
    let label: String
    let value: String
  }

  public struct Column: Decodable {
    let title: String
    let align: String
    let weight: Double
  }

  public struct Bar: Decodable {
    let label: String
    let value: String
    let fraction: Double
  }

  public enum Block: Decodable {
    case heading(String)
    case text(String)
    case stats([Stat])
    case table(columns: [Column], rows: [[String]], total: [String]?)
    case bars([Bar])

    private enum Keys: String, CodingKey { case type, text, items, columns, rows, total }

    public init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: Keys.self)
      let type = try c.decode(String.self, forKey: .type)
      switch type {
      case "heading": self = .heading(try c.decode(String.self, forKey: .text))
      case "text": self = .text(try c.decode(String.self, forKey: .text))
      case "stats": self = .stats(try c.decode([Stat].self, forKey: .items))
      case "table":
        self = .table(
          columns: try c.decode([Column].self, forKey: .columns),
          rows: try c.decode([[String]].self, forKey: .rows),
          total: try c.decodeIfPresent([String].self, forKey: .total))
      case "bars": self = .bars(try c.decode([Bar].self, forKey: .rows))
      default:
        throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unknown report block \"\(type)\"")
      }
    }
  }

  let title: String
  let subtitle: String
  let footer: String
  let direction: String?
  let blocks: [Block]

  var rtl: Bool { direction == "rtl" }

  public static func parse(_ json: String) throws -> ReportDoc {
    try JSONDecoder().decode(ReportDoc.self, from: Data(json.utf8))
  }
}

/// Draws a `ReportDoc` as an A4 PDF (3.0, plan P12) with UIKit's own PDF
/// context and attributed strings: no web view, no library. Text is laid out
/// by the system, so every script the phone can show wraps and shapes as it
/// does on screen, and it stays text in the file (selectable, searchable).
///
/// One pass, top to bottom, by the same rules as Android's ReportPdf.kt: each
/// block is measured, moved to a new page when it does not fit, then drawn. A
/// table repeats its header on each page it continues on; a row is never
/// split. Always light. Sizes are points (1/72 inch), the PDF's own unit.
public final class ReportPdf {
  static let pageSize = CGSize(width: 595, height: 842)
  static let margin: CGFloat = 40
  static let footerHeight: CGFloat = 28
  static let gap: CGFloat = 6
  static let ink = UIColor(red: 0.10, green: 0.10, blue: 0.10, alpha: 1)
  static let muted = UIColor(red: 0.37, green: 0.39, blue: 0.41, alpha: 1)
  static let rule = UIColor(red: 0.85, green: 0.85, blue: 0.84, alpha: 1)
  static let bar = UIColor(red: 0.24, green: 0.60, blue: 0.38, alpha: 1)
  static let track = UIColor(red: 0.93, green: 0.93, blue: 0.91, alpha: 1)

  private struct Style {
    let font: UIFont
    let color: UIColor
  }

  private let title = Style(font: .systemFont(ofSize: 20, weight: .bold), color: ReportPdf.ink)
  private let subtitle = Style(font: .systemFont(ofSize: 11), color: ReportPdf.muted)
  private let heading = Style(font: .systemFont(ofSize: 13, weight: .bold), color: ReportPdf.ink)
  private let body = Style(font: .systemFont(ofSize: 10), color: ReportPdf.ink)
  private let bodyBold = Style(font: .systemFont(ofSize: 10, weight: .bold), color: ReportPdf.ink)
  private let small = Style(font: .systemFont(ofSize: 9), color: ReportPdf.muted)
  private let statValue = Style(font: .systemFont(ofSize: 14, weight: .bold), color: ReportPdf.ink)
  private let footer = Style(font: .systemFont(ofSize: 8), color: ReportPdf.muted)

  private let doc: ReportDoc
  private var context: UIGraphicsPDFRendererContext?
  private var pageNumber = 0
  private var y: CGFloat = ReportPdf.margin
  private let width = ReportPdf.pageSize.width - 2 * ReportPdf.margin
  private let bottom = ReportPdf.pageSize.height - ReportPdf.margin - ReportPdf.footerHeight

  public init(_ doc: ReportDoc) { self.doc = doc }

  /// `text` in a style; `end` puts it on the far side for the page's direction.
  private func string(_ text: String, _ style: Style, end: Bool = false) -> NSAttributedString {
    let paragraph = NSMutableParagraphStyle()
    paragraph.baseWritingDirection = doc.rtl ? .rightToLeft : .leftToRight
    paragraph.alignment = end ? (doc.rtl ? .left : .right) : (doc.rtl ? .right : .left)
    paragraph.lineBreakMode = .byWordWrapping
    return NSAttributedString(
      string: text, attributes: [.font: style.font, .foregroundColor: style.color, .paragraphStyle: paragraph])
  }

  private func height(_ text: NSAttributedString, _ width: CGFloat) -> CGFloat {
    ceil(
      text.boundingRect(
        with: CGSize(width: max(width, 1), height: .greatestFiniteMagnitude),
        options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil
      ).height)
  }

  private func draw(_ text: NSAttributedString, x: CGFloat, top: CGFloat, width: CGFloat) {
    text.draw(
      with: CGRect(x: x, y: top, width: max(width, 1), height: .greatestFiniteMagnitude),
      options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
  }

  /// The left edge of a box `boxWidth` wide that starts `offset` from the page's leading edge.
  private func leading(_ offset: CGFloat, _ boxWidth: CGFloat) -> CGFloat {
    doc.rtl ? ReportPdf.pageSize.width - ReportPdf.margin - offset - boxWidth : ReportPdf.margin + offset
  }

  private func line(at lineY: CGFloat) {
    guard let cg = context?.cgContext else { return }
    cg.setStrokeColor(ReportPdf.rule.cgColor)
    cg.setLineWidth(0.75)
    cg.move(to: CGPoint(x: ReportPdf.margin, y: lineY))
    cg.addLine(to: CGPoint(x: ReportPdf.pageSize.width - ReportPdf.margin, y: lineY))
    cg.strokePath()
  }

  private func finishPage() {
    guard pageNumber > 0 else { return }
    let top = ReportPdf.pageSize.height - ReportPdf.margin - ReportPdf.footerHeight + 10
    line(at: top)
    draw(string(doc.footer, footer), x: leading(0, width * 0.8), top: top + 6, width: width * 0.8)
    draw(string(String(pageNumber), footer, end: true), x: leading(width * 0.8, width * 0.2), top: top + 6, width: width * 0.2)
  }

  private func newPage() {
    finishPage()
    context?.beginPage()
    pageNumber += 1
    y = ReportPdf.margin
  }

  /// Moves to a new page when `height` does not fit under the cursor.
  private func room(_ height: CGFloat) {
    if pageNumber == 0 || y + height > bottom { newPage() }
  }

  private func paragraph(_ text: String, _ style: Style, above: CGFloat = 0, below: CGFloat = ReportPdf.gap) {
    let laid = string(text, style)
    let h = height(laid, width)
    room(above + h)
    y += above
    draw(laid, x: ReportPdf.margin, top: y, width: width)
    y += h + below
  }

  private func stats(_ items: [ReportDoc.Stat]) {
    let shown = Array(items.prefix(4))
    guard !shown.isEmpty else { return }
    let cell = width / CGFloat(shown.count)
    let laid = shown.map { (string($0.label, small), string($0.value, statValue)) }
    let heights = laid.map { (height($0.0, cell - 8), height($0.1, cell - 8)) }
    let total = heights.map { $0.0 + 2 + $0.1 }.max() ?? 0
    room(total + ReportPdf.gap)
    for (index, pair) in laid.enumerated() {
      let x = leading(CGFloat(index) * cell, cell - 8)
      draw(pair.0, x: x, top: y, width: cell - 8)
      draw(pair.1, x: x, top: y + heights[index].0 + 2, width: cell - 8)
    }
    y += total + ReportPdf.gap * 2
  }

  private func table(_ columns: [ReportDoc.Column], _ rows: [[String]], _ total: [String]?) {
    guard !columns.isEmpty else { return }
    let weights = columns.reduce(0) { $0 + max($1.weight, 0.1) }
    let widths = columns.map { CGFloat(max($0.weight, 0.1) / weights) * width }
    var offsets: [CGFloat] = [0]
    for w in widths { offsets.append((offsets.last ?? 0) + w) }
    func row(_ cells: [String], _ style: Style) -> [NSAttributedString] {
      columns.enumerated().map { index, column in
        string(index < cells.count ? cells[index] : "", style, end: column.align == "end")
      }
    }
    func rowHeight(_ cells: [NSAttributedString]) -> CGFloat {
      cells.enumerated().map { height($1, widths[$0] - 6) }.max() ?? 0
    }
    func drawRow(_ cells: [NSAttributedString], rule: Bool) {
      let h = rowHeight(cells)
      for (index, cell) in cells.enumerated() {
        draw(cell, x: leading(offsets[index] + 3, widths[index] - 6), top: y + 3, width: widths[index] - 6)
      }
      y += h + 6
      if rule { line(at: y) }
    }
    let header = row(columns.map(\.title), small)
    let headerHeight = rowHeight(header) + 6

    // The header and the first row stay together.
    let first = rows.first.map { rowHeight(row($0, body)) } ?? 0
    room(headerHeight + first + 6)
    drawRow(header, rule: true)
    for cells in rows {
      let laid = row(cells, body)
      if y + rowHeight(laid) + 6 > bottom {
        newPage()
        drawRow(header, rule: true)
      }
      drawRow(laid, rule: false)
    }
    if let total {
      let laid = row(total, bodyBold)
      if y + rowHeight(laid) + 8 > bottom {
        newPage()
        drawRow(header, rule: true)
      }
      line(at: y)
      drawRow(laid, rule: false)
    }
    y += ReportPdf.gap
  }

  private func bars(_ rows: [ReportDoc.Bar]) {
    let labelWidth = width * 0.34
    let valueWidth = width * 0.22
    let barWidth = width - labelWidth - valueWidth - 16
    for bar in rows {
      let label = string(bar.label, body)
      let value = string(bar.value, body, end: true)
      let h = max(height(label, labelWidth), height(value, valueWidth))
      room(h + 5)
      draw(label, x: leading(0, labelWidth), top: y, width: labelWidth)
      draw(value, x: leading(width - valueWidth, valueWidth), top: y, width: valueWidth)
      let left = leading(labelWidth + 8, barWidth)
      let top = y + h / 2 - 3
      ReportPdf.track.setFill()
      UIBezierPath(roundedRect: CGRect(x: left, y: top, width: barWidth, height: 6), cornerRadius: 3).fill()
      let filled = barWidth * CGFloat(min(max(bar.fraction, 0), 1))
      if filled > 0 {
        ReportPdf.bar.setFill()
        // The bar grows from the page's leading edge.
        let from = doc.rtl ? left + barWidth - filled : left
        UIBezierPath(roundedRect: CGRect(x: from, y: top, width: filled, height: 6), cornerRadius: 3).fill()
      }
      y += h + 5
    }
    y += ReportPdf.gap
  }

  /// Draws every block; returns the PDF and how many pages it took.
  public func data() -> (data: Data, pages: Int) {
    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: ReportPdf.pageSize))
    let data = renderer.pdfData { context in
      self.context = context
      newPage()
      paragraph(doc.title, title, below: 2)
      paragraph(doc.subtitle, subtitle, below: 10)
      line(at: y)
      y += 10
      for block in doc.blocks {
        switch block {
        case .heading(let text):
          // A heading never ends a page: it keeps room for a few lines under it.
          room(heading.font.pointSize + 60)
          paragraph(text, heading, above: 8)
        case .text(let text): paragraph(text, body)
        case .stats(let items): stats(items)
        case .table(let columns, let rows, let total): table(columns, rows, total)
        case .bars(let rows): bars(rows)
        }
      }
      finishPage()
      self.context = nil
    }
    return (data, pageNumber)
  }
}
