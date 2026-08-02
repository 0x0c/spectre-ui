import Foundation

// MARK: - Store

/// 画面のデータ保持。
///
/// `data` (サーバ提供・不変) と `state` (クライアント可変) を分けているのは、
/// サーバから来た値をクライアントがうっかり壊さないようにするためと、
/// 再取得時にどちらを保持するかを `statePolicy` で選べるようにするため
/// (docs/spec/schema.md §1)。
public final class Store {
    public private(set) var data: SpValue
    public private(set) var state: SpValue
    public let env: SpValue

    /// 直近の `consumeChangedPaths()` 以降に変化した state/data のパスの累積。差分再解決の入力になる。
    ///
    /// 1回のアクションディスパッチは複数回 state/data を書き換えうるため、上書きではなく
    /// 蓄積する。上書きだと列の途中の変更が再解決に反映されず、画面が古いまま止まって見える
    /// ことになる。
    public private(set) var lastChangedPaths: Set<String> = []

    public init(
        data: SpValue = .emptyObject,
        state: SpValue = .emptyObject,
        env: SpValue = .emptyObject
    ) {
        self.data = data
        self.state = state
        self.env = env
    }

    public func scope(locals: [String: SpValue] = [:]) -> EvalScope {
        EvalScope(data: data, state: state, env: env, locals: locals)
    }

    /// 蓄積した変更パスを取り出し、蓄積をリセットする。差分再解決を1回行うたびに呼ぶ。
    public func consumeChangedPaths() -> Set<String> {
        let changed = lastChangedPaths
        lastChangedPaths = []
        return changed
    }

    public func setState(_ path: String, _ value: SpValue) {
        state = state.settingPath(path, to: value)
        lastChangedPaths.insert("state.\(path)")
    }

    public func setStates(_ patch: [String: SpValue]) {
        var next = state
        for (path, value) in patch { next = next.settingPath(path, to: value) }
        state = next
        lastChangedPaths.formUnion(patch.keys.map { "state.\($0)" })
    }

    /// サーバ応答の `state` を浅くマージする。
    public func mergeState(_ patch: SpValue) {
        state = state.merging(patch)
        lastChangedPaths.formUnion((patch.asObject ?? [:]).keys.map { "state.\($0)" })
    }

    /// サーバ応答の `data` を浅くマージする。
    public func mergeData(_ patch: SpValue) {
        data = data.merging(patch)
        lastChangedPaths.formUnion((patch.asObject ?? [:]).keys.map { "data.\($0)" })
    }

    public func replaceData(_ next: SpValue) {
        data = next
        lastChangedPaths.insert("data")
    }

    public func resetState(_ next: SpValue) {
        state = next
        lastChangedPaths.insert("state")
    }
}

// MARK: - Host

/// SDK がホストアプリに要求する接続点。これ以上増やさない (docs/architecture.md §6)。
/// Android 側も同じシグネチャの `SpectreHostDelegate` を持つ。
public protocol SpectreHostDelegate: AnyObject {

    /// 論理エンドポイント名を実リクエストに解決して実行する。
    ///
    /// ベース URL・認証ヘッダ・リトライ・証明書ピンニングはすべてホストアプリの責務。
    /// ドキュメントには論理名しか書かれていないため、内部 URL や資格情報が
    /// CDN にキャッシュされる公開物に載ることがない。
    func performRequest(_ request: SpectreRequest) async throws -> SpectreActionResponse

    /// ドキュメントで表現できない画面遷移。既存のルーティングに委ねる。
    /// - Returns: 遷移を引き受けたら true。
    func navigate(to destination: SpectreDestination) -> Bool

    /// 共有シート・決済・カメラなど、SDUI で表現すべきでない機能への委譲。
    func performHostAction(name: String, params: SpValue) async throws -> SpValue?

    /// 計測イベントの転送先。
    func track(event: String, properties: SpValue)

    /// 外部 URL を開く。ドメインのアロウリスト判定はホストアプリが行う。
    func openURL(_ url: String, mode: String) -> Bool

    /// アクション実行前の割り込み機会。false を返すとその時点で中止する。
    func shouldPerform(_ action: SpValue) -> Bool
}

public extension SpectreHostDelegate {
    func shouldPerform(_ action: SpValue) -> Bool { true }
}

public struct SpectreRequest: Sendable {
    public let endpoint: String
    public let method: String
    public let pathParams: [String: SpValue]
    public let query: [String: SpValue]
    public let body: SpValue
    public let timeoutMs: Int
    public let idempotencyKey: String?
}

/// `request` に対するサーバ応答 (docs/spec/actions.md §3)。
/// 適用順は screen -> data -> state -> patch -> actions。
public struct SpectreActionResponse: Sendable {
    public let ok: Bool
    public let data: SpValue?
    public let state: SpValue?
    public let patch: [SpValue]
    public let screen: SpValue?
    public let actions: [SpValue]
    public let error: SpectreErrorPayload?

    public init(
        ok: Bool,
        data: SpValue? = nil,
        state: SpValue? = nil,
        patch: [SpValue] = [],
        screen: SpValue? = nil,
        actions: [SpValue] = [],
        error: SpectreErrorPayload? = nil
    ) {
        self.ok = ok
        self.data = data
        self.state = state
        self.patch = patch
        self.screen = screen
        self.actions = actions
        self.error = error
    }

    public static func failure(code: String, message: String) -> SpectreActionResponse {
        SpectreActionResponse(ok: false, error: SpectreErrorPayload(code: code, message: message))
    }

    /// サーバの生 JSON から応答を組み立てる。
    public static func from(ok: Bool, body: SpValue) -> SpectreActionResponse {
        guard body.asObject != nil else { return SpectreActionResponse(ok: ok) }
        let errorValue = body["error"]
        let payload: SpectreErrorPayload? = errorValue?.asObject != nil
            ? SpectreErrorPayload(
                code: errorValue?["code"]?.asString ?? "UNKNOWN",
                message: errorValue?["message"]?.asString ?? "",
                fields: errorValue?["fields"] ?? .emptyObject
              )
            : nil
        return SpectreActionResponse(
            ok: ok && payload == nil,
            data: body["data"],
            state: body["state"],
            patch: body["patch"]?.asArray ?? [],
            screen: body["screen"],
            actions: body["actions"]?.asArray ?? [],
            error: payload
        )
    }
}

public struct SpectreErrorPayload: Sendable, Equatable {
    public let code: String
    public let message: String
    public let fields: SpValue

    public init(code: String, message: String, fields: SpValue = .emptyObject) {
        self.code = code
        self.message = message
        self.fields = fields
    }

    /// onError ハンドラの式から `${error.code}` として参照できる形。
    public func toScopeValue() -> SpValue {
        .object([
            "code": .string(code),
            "message": .string(message),
            "fields": fields,
        ])
    }
}

public struct SpectreDestination: Sendable {
    public let mode: String
    public let screen: String?
    public let route: String?
    public let params: [String: SpValue]
}

/// SDK 内部の UI 副作用。オーバレイの開閉やフォーカス移動など、
/// ホストアプリではなく描画層が処理するもの。
public enum SpectreUIEffect: Sendable {
    case showOverlay(String)
    case dismissOverlay(String?)
    case back
    case dismiss
    case refresh(preserveState: Bool)
    case focus(String)
    case scrollTo(nodeID: String, animated: Bool)
    case replaceScreen(SpValue)
    /// ドキュメントの部分更新。適用は画面のコントローラが行う。
    case applyPatch([SpValue])
}
