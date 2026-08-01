import Foundation
import UIKit
import SpectreCore

/// サンプルアプリのホスト実装。
///
/// ここが「SDK がホストアプリに要求するもの」のすべて (docs/architecture.md §6)。
/// 実アプリではこの中で既存のネットワーク層・ルーティング・計測基盤に繋ぐ。
///
/// サンプルではサーバを立てずに応答を模擬している。重要なのは
/// **論理エンドポイント名 -> 実リクエスト の解決がホスト側にある**という構造で、
/// これによりドキュメントに内部 URL や認証情報が載ることがない。
/// Android の `SampleHostDelegate.kt` と対になっている。
final class SampleHostDelegate: SpectreHostDelegate {

    /// ホストが受け付ける論理エンドポイント。ここにない名前は実行されない。
    private let registeredEndpoints: Set<String> = ["cart.add", "settings.save"]

    /// ホストが受け付ける URL のドメイン。ここにないホストは開かない。
    private let allowedURLHosts: Set<String> = ["example.com", "www.example.com"]

    /// ホストが提供する機能。ドキュメントからは `host` アクションで呼ばれる。
    private let registeredHostActions: Set<String> = ["share"]

    private let onEvent: (String) -> Void
    private var failureCounter = 0

    init(onEvent: @escaping (String) -> Void = { _ in }) {
        self.onEvent = onEvent
    }

    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse {
        guard registeredEndpoints.contains(request.endpoint) else {
            return .failure(
                code: "ENDPOINT_NOT_REGISTERED",
                message: "エンドポイント '\(request.endpoint)' は登録されていません"
            )
        }

        onEvent("→ \(request.method) \(request.endpoint) \(request.body.stringify())")
        // ネットワーク往復の体感を出すための待ち
        try? await Task.sleep(nanoseconds: 600_000_000)

        switch request.endpoint {
        case "cart.add":
            let qty = request.body["qty"]?.stringify() ?? "1"
            return SpectreActionResponse(ok: true, state: .object(["cartCount": .string(qty)]))

        case "settings.save":
            // 3回に1回失敗させて onError 側の経路も確認できるようにする
            failureCounter += 1
            if failureCounter % 3 == 0 {
                return .failure(code: "SERVER_BUSY", message: "サーバが混み合っています")
            }
            return SpectreActionResponse(ok: true)

        default:
            return SpectreActionResponse(ok: true)
        }
    }

    func navigate(to destination: SpectreDestination) -> Bool {
        // サンプルには遷移先の画面がないので、受け取ったことだけを見せる
        onEvent("navigate \(destination.mode) \(destination.screen ?? destination.route ?? "")")
        return false
    }

    func performHostAction(name: String, params: SpValue) async throws -> SpValue? {
        guard registeredHostActions.contains(name) else {
            throw SampleHostError.unregisteredAction(name)
        }
        onEvent("host:\(name)")
        if name == "share" {
            let text = params["text"]?.stringify() ?? ""
            let url = params["url"]?.stringify() ?? ""
            await MainActor.run {
                let items: [Any] = [text, url].filter { !($0 as String).isEmpty }
                let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
                Self.topViewController()?.present(activity, animated: true)
            }
        }
        return nil
    }

    func track(event: String, properties: SpValue) {
        onEvent("track \(event) \(properties.stringify())")
    }

    func openURL(_ url: String, mode: String) -> Bool {
        guard let parsed = URL(string: url), let host = parsed.host, allowedURLHosts.contains(host) else {
            // アロウリスト外は開かない。ドキュメントは公開物なので、
            // 任意の URL を開けるとフィッシングの経路になる。
            onEvent("openUrl 拒否 (アロウリスト外) \(url)")
            return false
        }
        onEvent("openUrl \(url)")
        Task { @MainActor in UIApplication.shared.open(parsed) }
        return true
    }

    @MainActor
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

enum SampleHostError: LocalizedError {
    case unregisteredAction(String)

    var errorDescription: String? {
        switch self {
        case .unregisteredAction(let name):
            return "host アクション '\(name)' は登録されていません"
        }
    }
}
