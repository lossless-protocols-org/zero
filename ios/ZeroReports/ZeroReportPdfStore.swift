import Foundation
import UIKit

/// What the JS bridge (ios/zero/Reports/ZeroReportPdf.mm) calls (3.0, plan
/// P12): draws a report the app wrote as a PDF and offers it through the
/// system share sheet. The file lives in the app's own caches, in `reports/`,
/// which holds one report at a time. zero sends it nowhere itself.
@objc(ZeroReportPdfStore)
public final class ZeroReportPdfStore: NSObject {
  private static var folder: URL {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("reports", isDirectory: true)
  }

  /// `completion(path, nil)` with the file's path, or `(nil, failure)`. The failure names what went wrong, never a figure.
  @objc public static func render(_ json: String, fileName: String, completion: @escaping (String?, String?) -> Void) {
    // UIKit's text drawing is main-thread work.
    DispatchQueue.main.async {
      do {
        let doc = try ReportDoc.parse(json)
        // A name, never a path: nothing outside the reports folder can be written.
        let last = (fileName as NSString).lastPathComponent
        let name = last.hasSuffix(".pdf") && last.count > 4 ? last : "report.pdf"
        let manager = FileManager.default
        // One report at a time: the last one has been shared or abandoned.
        try? manager.removeItem(at: folder)
        try manager.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(name)
        try ReportPdf(doc).data().data.write(to: file, options: .atomic)
        completion(file.path, nil)
      } catch {
        completion(nil, "report: \(type(of: error))")
      }
    }
  }

  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    var top = scenes.flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }

  /// Shows the share sheet for a file `render` made; `completion(failure)` once it has closed.
  @objc public static func share(_ path: String, title: String, completion: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      let file = URL(fileURLWithPath: path).standardizedFileURL
      guard file.deletingLastPathComponent().path == folder.standardizedFileURL.path,
        FileManager.default.fileExists(atPath: file.path)
      else {
        completion("report: not a file this module made")
        return
      }
      guard let top = topViewController() else {
        completion("report: no screen to show the share sheet on")
        return
      }
      let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
      sheet.title = title
      // iPad: the sheet is a popover and needs somewhere to point.
      sheet.popoverPresentationController?.sourceView = top.view
      sheet.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 0, height: 0)
      var settled = false
      let settle: (String?) -> Void = { failure in
        if !settled {
          settled = true
          completion(failure)
        }
      }
      sheet.completionWithItemsHandler = { _, _, _, _ in settle(nil) }
      top.present(sheet, animated: true)
      // UIKit refuses to present over a screen that is itself mid-transition, and says nothing:
      // without this the caller would wait for a sheet that never came.
      if sheet.presentingViewController == nil {
        settle("report: the share sheet could not be shown")
      }
    }
  }
}
