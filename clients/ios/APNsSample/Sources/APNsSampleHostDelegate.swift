import Foundation
import UIKit
import SpectreCore

/// SU-0002 の `SampleHostDelegate` を元にした最小限のホスト実装 (SU-0012 の詳細設計 §4)。
///
/// このサンプルの主眼は通知配信そのものにあるため、`request` エンドポイントは
/// 登録しない。`track` と `openURL` だけ、操作したことがその場で見えるように配線する。
final class APNsSampleHostDelegate: SpectreHostDelegate {
    private let allowedURLHosts: Set<String> = ["example.com", "www.example.com"]
    private let onEvent: (String) -> Void

    init(onEvent: @escaping (String) -> Void = { _ in }) {
        self.onEvent = onEvent
    }

    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse {
        .failure(code: "ENDPOINT_NOT_REGISTERED", message: "このサンプルはエンドポイントを登録していません")
    }

    func navigate(to destination: SpectreDestination) -> Bool {
        onEvent("navigate \(destination.mode) \(destination.screen ?? destination.route ?? "")")
        return false
    }

    func performHostAction(name: String, params: SpValue) async throws -> SpValue? {
        onEvent("host:\(name)")
        return nil
    }

    func track(event: String, properties: SpValue) {
        onEvent("track \(event) \(properties.stringify())")
    }

    func openURL(_ url: String, mode: String) -> Bool {
        guard let parsed = URL(string: url), let host = parsed.host, allowedURLHosts.contains(host) else {
            onEvent("openUrl 拒否 (アロウリスト外) \(url)")
            return false
        }
        onEvent("openUrl \(url)")
        Task { @MainActor in UIApplication.shared.open(parsed) }
        return true
    }
}
