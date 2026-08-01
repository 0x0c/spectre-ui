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

    public private(set) var document: Document?
    public private(set) var store: Store?

    // Resolver と Dispatcher で同じ TemplateEvaluator を共有し、AST キャッシュを効かせる。
    private let templates = TemplateEvaluator()
    private let resolver: Resolver
    private let dispatcher: ActionDispatcher
    private let env: SpValue
    private var toastTask: Task<Void, Never>?

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
        self.store = Store(data: document.data, state: document.state, env: env)
        visibleOverlays.removeAll()
        activeToast = nil
        reresolve()
        if !document.onAppear.isEmpty { dispatch(document.onAppear) }
    }

    /// 木全体を解決し直す。
    ///
    /// 差分再解決 (変更された state パスに依存するノードだけを解決し直す) は
    /// `Expr.dependencies()` で依存パスを取れるところまで用意してあるが、
    /// まだ接続していない。上限 2,000 ノードの全解決で足りているうちは、
    /// 単純さを優先する。
    public func reresolve() {
        guard let document, let store else { return }
        render = resolver.resolve(document, scope: store.scope())
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

    private func apply(_ effect: SpectreUIEffect) {
        switch effect {
        case .showOverlay(let id): showOverlay(id)
        case .dismissOverlay(let id): dismissOverlay(id)
        case .back: onBack?()
        case .dismiss: onDismiss?()
        case .refresh(let preserveState): onRefreshRequested?(preserveState)
        case .replaceScreen(let document): onReplaceScreen?(document)

        // フォーカス移動・スクロール・部分更新は未実装。黙って無視すると
        // 「動いていないことに気づけない」ので、ホストに通知して可視化する。
        case .focus: onUnimplementedEffect?("focus")
        case .scrollTo: onUnimplementedEffect?("scrollTo")
        case .applyPatch: onUnimplementedEffect?("applyPatch")
        }
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
