import SwiftUI
import SpectreCore

/// 1画面ぶんの実行時状態。
///
/// ドキュメント・ストア・解決結果・オーバレイの表示状態を束ね、
/// アクションのディスパッチと再解決を仲介する。
///
/// `@MainActor` にしているのは、`TemplateEvaluator` の AST キャッシュが
/// 同期を持たないため。Android 側の `SpectreScreenController` と同じ前提。
@MainActor
public final class SpectreScreenModel: ObservableObject {

    @Published public private(set) var render: ResolveResult?
    @Published public private(set) var visibleOverlays: [String] = []
    @Published public private(set) var activeToast: RenderOverlay?
    /// 実行中の request があるか。プルリフレッシュのインジケータなどに使う。
    @Published public private(set) var isBusy = false
    /// `focus` アクションが指定した nodeId。ビュー側がこれを見てフォーカスを移す。
    @Published public private(set) var focusRequest: String?
    /// `scrollTo` アクションが指定した対象。同じ nodeId への連続リクエストも見分けられるよう連番を持つ。
    @Published public private(set) var scrollRequest: ScrollRequest?

    public struct ScrollRequest: Equatable, Sendable {
        public let nodeID: String
        public let animated: Bool
        public let seq: Int
    }

    private var scrollRequestSeq = 0

    public private(set) var document: Document?
    public private(set) var store: Store?

    // Resolver と Dispatcher で同じ TemplateEvaluator を共有し、AST キャッシュを効かせる。
    private let templates = TemplateEvaluator()
    private let resolver: Resolver
    private let dispatcher: ActionDispatcher
    private let env: SpValue
    private var toastTask: Task<Void, Never>?

    /// 直近の解決結果。差分再解決の入力として次回に渡す (docs/architecture.md §2)。
    private var traced: TracedResolveResult?

    // ホストアプリ側が差し込むコールバック。SDK が扱えない遷移をここで受ける。
    public var onBack: (() -> Void)?
    public var onDismiss: (() -> Void)?
    public var onRefreshRequested: ((Bool) -> Void)?
    public var onReplaceScreen: ((SpValue) -> Void)?
    public var onUnimplementedEffect: ((String) -> Void)?

    public init(
        host: SpectreHostDelegate,
        env: SpValue = .emptyObject,
        supportedComponents: Set<String> = GeneratedCatalog.componentNames
    ) {
        self.env = env
        self.resolver = Resolver(templates: templates, supportedComponents: supportedComponents)
        self.dispatcher = ActionDispatcher(host: host, templates: templates)
    }

    public func load(_ document: Document) {
        self.document = document
        let store = Store(data: document.data, state: document.state, env: env)
        self.store = store
        visibleOverlays.removeAll()
        activeToast = nil
        let fresh = resolver.resolveTraced(document, scope: store.scope())
        traced = fresh
        render = fresh.result
        if !document.onAppear.isEmpty { dispatch(document.onAppear) }
    }

    /// 木を再解決する。
    ///
    /// 変更された state/data のパスに依存しないノードは、`Resolver.reresolveTraced` が
    /// 前回の `RenderNode` をそのまま使い回す。初回 (`load`) だけは比較対象がないため
    /// 常に全解決になる。
    public func reresolve() {
        guard let document, let store, let previous = traced else { return }
        let changed = store.consumeChangedPaths()
        let next = resolver.reresolveTraced(document, previous: previous, changedPaths: changed, scope: store.scope())
        traced = next
        render = next.result
    }

    /// 入力コンポーネントの双方向バインド。
    public func setStateValue(_ path: String, _ value: SpValue) {
        store?.setState(path, value)
        reresolve()
    }

    public func stateValue(_ path: String) -> SpValue {
        store?.state.path(path) ?? .null
    }

    /// 入力コンポーネント用の SwiftUI Binding を作る。
    public func binding(
        _ path: String,
        onCommit: @escaping () -> Void = {}
    ) -> Binding<SpValue> {
        Binding(
            get: { [weak self] in self?.stateValue(path) ?? .null },
            set: { [weak self] newValue in
                self?.setStateValue(path, newValue)
                onCommit()
            }
        )
    }

    public func dispatch(_ actions: [SpValue], locals: [String: SpValue] = [:]) {
        guard !actions.isEmpty, let store else { return }
        Task { @MainActor in
            isBusy = true
            let result = await dispatcher.dispatch(actions, store: store, locals: locals)
            for effect in result.uiEffects { apply(effect) }
            isBusy = false
            reresolve()
        }
    }

    public func dismissOverlay(_ id: String?) {
        if let id {
            visibleOverlays.removeAll { $0 == id }
        } else {
            visibleOverlays.removeAll()
        }
    }

    /// [focusRequest] を消費する。ビューがフォーカスを移し終えたら呼ぶ。
    public func consumeFocusRequest() {
        focusRequest = nil
    }

    /// [scrollRequest] を消費する。ビューがスクロールし終えたら呼ぶ。
    public func consumeScrollRequest() {
        scrollRequest = nil
    }

    private func apply(_ effect: SpectreUIEffect) {
        switch effect {
        case .showOverlay(let id): showOverlay(id)
        case .dismissOverlay(let id): dismissOverlay(id)
        case .back: onBack?()
        case .dismiss: onDismiss?()
        case .refresh(let preserveState): onRefreshRequested?(preserveState)
        case .replaceScreen(let document): onReplaceScreen?(document)
        case .focus(let nodeID): focusRequest = nodeID
        case .scrollTo(let nodeID, let animated):
            scrollRequestSeq += 1
            scrollRequest = ScrollRequest(nodeID: nodeID, animated: animated, seq: scrollRequestSeq)
        case .applyPatch(let operations): applyPatch(operations)
        }
    }

    /// `applyPatch` (RFC 6902)。パース前の生 JSON (`Document.raw`) に適用してから
    /// 再パースする — 木構造は差し替わるが `store` はそのまま使い続けるので
    /// `state`/`data` は保持される (docs/spec/actions.md `applyPatch`)。
    private func applyPatch(_ operations: [SpValue]) {
        guard let currentDocument = document, let store else { return }
        guard let raw = currentDocument.raw else {
            // DocumentParser を経由しない手組みの Document には適用しようがない。
            onUnimplementedEffect?("applyPatch")
            return
        }
        guard let patched = try? JsonPatch.apply(raw, operations),
              let newDocument = try? DocumentParser.parse(value: patched) else { return }
        document = newDocument
        let fresh = resolver.resolveTraced(newDocument, scope: store.scope())
        traced = fresh
        render = fresh.result
    }

    private func showOverlay(_ id: String) {
        guard let overlay = render?.overlays.first(where: { $0.id == id }) else { return }
        if overlay.kind == .toast {
            toastTask?.cancel()
            activeToast = overlay
            let durationMs = overlay.props["durationMs"]?.asInt ?? 3000
            let clamped = min(max(durationMs, 1000), 10_000)
            toastTask = Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(clamped) * 1_000_000)
                guard !Task.isCancelled else { return }
                self?.activeToast = nil
            }
        } else if !visibleOverlays.contains(id) {
            visibleOverlays.append(id)
        }
    }
}

/// 端末環境を式から参照できる形にまとめる (`env.platform` など)。
@MainActor
public func spectreEnvironment(
    appVersion: String = "0.0.0",
    colorScheme: ColorScheme = .light,
    horizontalSizeClass: UserInterfaceSizeClass? = nil
) -> SpValue {
    .object([
        "platform": .string("ios"),
        "appVersion": .string(appVersion),
        "osVersion": .string(ProcessInfo.processInfo.operatingSystemVersionString),
        "locale": .string(Locale.current.identifier.replacingOccurrences(of: "_", with: "-")),
        "timeZone": .string(TimeZone.current.identifier),
        "theme": .string(colorScheme == .dark ? "dark" : "light"),
        "widthClass": .string(horizontalSizeClass == .regular ? "regular" : "compact"),
        "fontScale": .number(1.0),
        "isOnline": .bool(true),
    ])
}
