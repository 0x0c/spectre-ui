import Foundation
import SpectreCore

/// リモート通知のペイロードから Spectre UI ドキュメントを取り出して保持する。
///
/// カスタムペイロードキー `spectreDocument` に、ドキュメントを JSON オブジェクトとして
/// そのまま埋め込む (文字列に二重エスケープしない)。取り出した値を再シリアライズし、
/// 既存の `DocumentParser` にそのまま渡す。SU-0012 の詳細設計 §3 に対応する。
@MainActor
final class PushDocumentStore: ObservableObject {
    static let shared = PushDocumentStore()

    static let payloadKey = "spectreDocument"

    @Published private(set) var document: Document?
    @Published private(set) var loadError: String?
    @Published private(set) var receivedCount = 0

    private init() {}

    func handle(userInfo: [AnyHashable: Any]) {
        receivedCount += 1

        guard let payload = userInfo[Self.payloadKey] else {
            loadError = "ペイロードに '\(Self.payloadKey)' がありません"
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: payload)
            guard let text = String(data: data, encoding: .utf8) else {
                throw SpectreError.parse("UTF-8 として解釈できません")
            }
            document = try DocumentParser.parse(text: text)
            loadError = nil
        } catch {
            loadError = String(describing: error)
        }
    }
}
