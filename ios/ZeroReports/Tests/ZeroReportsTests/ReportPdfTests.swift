import CoreGraphics
import Foundation
import XCTest

@testable import ZeroReports

/// PDF reports, iOS side (3.0, plan P12), on the documents the JS builders
/// wrote (contracts/report-doc.json; Android draws the same file): each
/// parses whole, draws to a real PDF that Core Graphics reads back with the
/// page count the renderer reports, and a long one runs over several pages.
final class ReportPdfTests: XCTestCase {
  /// The repository root: this file is ios/ZeroReports/Tests/ZeroReportsTests/ReportPdfTests.swift.
  static let contract: [String: Any] = {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { url.deleteLastPathComponent() }
    let data = (try? Data(contentsOf: url.appendingPathComponent("contracts/report-doc.json"))) ?? Data()
    // A missing or unreadable contract fails every test that reads it, by name.
    return ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any]) ?? [:]
  }()

  func json(_ name: String, editing edit: (inout [String: Any]) -> Void = { _ in }) throws -> String {
    var object = try XCTUnwrap(Self.contract[name] as? [String: Any], "no \(name) in the contract")
    edit(&object)
    return String(decoding: try JSONSerialization.data(withJSONObject: object), as: UTF8.self)
  }

  func pages(of data: Data) -> Int {
    guard let provider = CGDataProvider(data: data as CFData), let pdf = CGPDFDocument(provider) else { return -1 }
    return pdf.numberOfPages
  }

  func testReadsEveryBlockTheAppWrites() throws {
    let doc = try ReportDoc.parse(try json("spending"))
    XCTAssertEqual(doc.title, "Spending report")
    XCTAssertEqual(doc.subtitle, "7 Nov – 6 Dec 2026")
    XCTAssertFalse(doc.rtl)
    XCTAssertEqual(doc.blocks.count, 8)
    guard case .table(let columns, let rows, let total) = doc.blocks[5] else {
      return XCTFail("the sixth block is the category table")
    }
    XCTAssertEqual(columns.map(\.title), ["Category", "Amount", "Share"])
    XCTAssertEqual(columns.map(\.align), ["start", "end", "end"])
    XCTAssertEqual(rows.count, 3)
    XCTAssertEqual(total, ["Total", "₹5,560.3", ""])
    XCTAssertTrue(try ReportDoc.parse(try json("rtl")).rtl)
  }

  func testABlockOfAKindThisBuildDoesNotKnowIsAnErrorNeverAMissingSection() throws {
    let unknown = try json("spending") { doc in
      var blocks = doc["blocks"] as? [Any] ?? []
      blocks.append(["type": "chart"])
      doc["blocks"] = blocks
    }
    XCTAssertThrowsError(try ReportDoc.parse(unknown))
  }

  func testEveryPinnedDocumentDrawsToAPdfOfOnePage() throws {
    for name in ["spending", "trends", "rtl"] {
      let made = ReportPdf(try ReportDoc.parse(try json(name))).data()
      XCTAssertEqual(made.pages, 1, name)
      XCTAssertEqual(pages(of: made.data), 1, name)
      XCTAssertEqual(String(decoding: made.data.prefix(4), as: UTF8.self), "%PDF", name)
      XCTAssertGreaterThan(made.data.count, 1500, name)
    }
  }

  func testALongReportRunsOverSeveralPages() throws {
    let made = ReportPdf(try ReportDoc.parse(try json("long"))).data()
    XCTAssertTrue((3...8).contains(made.pages), "140 entries took \(made.pages) page(s)")
    XCTAssertEqual(pages(of: made.data), made.pages)
  }

  func testOddInputIsBoundedNotACrash() throws {
    let odd = """
      {"title":"t","subtitle":"s","footer":"f","direction":"ltr","blocks":[
        {"type":"bars","rows":[{"label":"a","value":"1","fraction":7},{"label":"b","value":"2","fraction":-1}]},
        {"type":"table","columns":[{"title":"A","align":"start","weight":0},{"title":"B","align":"end","weight":1}],"rows":[["only one cell"]]},
        {"type":"table","columns":[],"rows":[]},
        {"type":"stats","items":[]}]}
      """
    let made = ReportPdf(try ReportDoc.parse(odd)).data()
    XCTAssertEqual(pages(of: made.data), 1)
  }

  func testTextStaysTextInTheFile() throws {
    // Selectable and searchable: the PDF carries fonts, not a picture of the page.
    let made = ReportPdf(try ReportDoc.parse(try json("spending"))).data()
    let provider = try XCTUnwrap(CGDataProvider(data: made.data as CFData))
    let page = try XCTUnwrap(CGPDFDocument(provider)?.page(at: 1))
    var resources: CGPDFDictionaryRef?
    XCTAssertTrue(CGPDFDictionaryGetDictionary(try XCTUnwrap(page.dictionary), "Resources", &resources))
    var fonts: CGPDFDictionaryRef?
    XCTAssertTrue(CGPDFDictionaryGetDictionary(try XCTUnwrap(resources), "Font", &fonts))
  }
}
