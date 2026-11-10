import Foundation

/// zero:// links the widgets open (src/navigation/linking.ts). Ids and kinds only.
enum ZeroLinks {
  /// The quick-add sheet over the app, for an entry kind and optionally a category.
  static func quick(kind: String = "expense", categoryId: String? = nil) -> URL {
    var components = URLComponents()
    components.scheme = "zero"
    components.host = "quick"
    components.queryItems =
      [URLQueryItem(name: "kind", value: kind)]
      + (categoryId.map { [URLQueryItem(name: "categoryId", value: $0)] } ?? [])
    // Built from fixed parts and a percent-encoded id: always a valid URL.
    return components.url ?? URL(fileURLWithPath: "/")
  }
}
