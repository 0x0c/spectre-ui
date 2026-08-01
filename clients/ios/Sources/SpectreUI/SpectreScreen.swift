import SwiftUI
import SpectreCore

/// ドキュメント1つを描画する公開エントリポイント。
///
/// ホストアプリから見える API はこれと `SpectreHostDelegate` だけ。
public struct SpectreScreen: View {
    private let document: Document
    private let theme: SpectreTheme
    private let onBack: (() -> Void)?

    @StateObject private var model: SpectreScreenModel

    public init(
        document: Document,
        host: SpectreHostDelegate,
        env: SpValue = .emptyObject,
        theme: SpectreTheme = SpectreTheme(),
        onBack: (() -> Void)? = nil
    ) {
        self.document = document
        self.theme = theme
        self.onBack = onBack
        _model = StateObject(wrappedValue: SpectreScreenModel(host: host, env: env))
    }

    public var body: some View {
        ScreenContent(document: document)
            .environmentObject(model)
            .environment(\.spectreTheme, theme)
            .onAppear {
                model.onBack = onBack
                model.load(document)
            }
            .onChange(of: document.id) { _ in
                model.load(document)
            }
    }
}

/// Screen ノードの描画。ルート専用なので `SpectreNodeView` の分岐には含めない。
private struct ScreenContent: View {
    let document: Document
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        Group {
            if let root = model.render?.root {
                screenBody(root)
            } else {
                ProgressView()
            }
        }
        .overlay(alignment: .bottom) { toastOverlay }
        .modifier(OverlayHost(model: model))
    }

    @ViewBuilder
    private func screenBody(_ node: RenderNode) -> some View {
        let scrollable = node.bool("scrollable", default: true)
        let background = theme.color(node.token("background", default: "background"), default: Color.spectreBackground)
        let appBar = node.props["appBar"]?.asObject
        let bottomBar = node.node("bottomBar")

        VStack(spacing: 0) {
            Group {
                if scrollable {
                    // ScrollViewReader を挟むのは `scrollTo` アクションの着地点にするため。
                    // 対象ノードは SpectreNodeView が汎用的に `.id(nodeID)` を付けている。
                    ScrollViewReader { proxy in
                        ScrollView { content(node) }
                            .onChange(of: model.scrollRequest) { request in
                                guard let request else { return }
                                withAnimation(request.animated ? .default : nil) {
                                    proxy.scrollTo(request.nodeID, anchor: .center)
                                }
                                model.consumeScrollRequest()
                            }
                    }
                } else {
                    content(node)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // bottomBar はスクロールに追従しない下部固定領域
            if let bottomBar {
                SpectreNodeView(bottomBar)
            }
        }
        .background(background.ignoresSafeArea())
        .navigationTitle(appBar?["title"]?.stringify() ?? document.meta.title ?? "")
        .spectreInlineNavigationTitle()
        .toolbar {
            ToolbarItemGroup(placement: spectreToolbarTrailingPlacement) {
                ForEach(Array(node.nodes("appBar.actions[]").enumerated()), id: \.offset) { _, action in
                    SpectreNodeView(action)
                }
            }
        }
    }

    @ViewBuilder
    private func content(_ node: RenderNode) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SpectreChildren(nodes: node.children)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = model.activeToast {
            Text(toast.props["message"]?.stringify() ?? "")
                .font(theme.font("bodySm"))
                .foregroundStyle(theme.color("onSurface", default: .primary))
                .padding(.horizontal, theme.space("md"))
                .padding(.vertical, theme.space("sm"))
                .background(
                    Capsule().fill(theme.color("surface", default: Color.spectreSurface))
                )
                .shadow(radius: 6)
                .padding(.bottom, theme.space("xl"))
                .transition(.opacity)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }
}

/// シート・アラートの表示。
///
/// これらを木の中に置かず画面レベルの状態として扱うのは、iOS と Android で
/// モーダル表示の仕組みが大きく異なるため (docs/spec/schema.md §3)。
private struct OverlayHost: ViewModifier {
    @ObservedObject var model: SpectreScreenModel

    func body(content: Content) -> some View {
        var view = AnyView(content)
        for overlay in model.render?.overlays ?? [] {
            let isVisible = model.visibleOverlays.contains(overlay.id)
            switch overlay.kind {
            case .sheet:
                view = AnyView(view.sheet(isPresented: binding(overlay.id, isVisible)) {
                    SheetContent(overlay: overlay).environmentObject(model)
                })
            case .alert:
                view = AnyView(
                    view.alert(
                        overlay.props["title"]?.stringify() ?? "",
                        isPresented: binding(overlay.id, isVisible)
                    ) {
                        ForEach(overlay.buttons) { button in
                            Button(button.label, role: roleOf(button.role)) {
                                model.dismissOverlay(overlay.id)
                                model.dispatch(button.actions)
                            }
                        }
                    } message: {
                        Text(overlay.props["message"]?.stringify() ?? "")
                    }
                )
            case .toast:
                // トーストは visibleOverlays ではなく activeToast で管理する
                break
            }
        }
        return view
    }

    private func binding(_ id: String, _ isVisible: Bool) -> Binding<Bool> {
        Binding(
            get: { isVisible },
            set: { shown in if !shown { model.dismissOverlay(id) } }
        )
    }

    private func roleOf(_ role: String) -> ButtonRole? {
        switch role {
        case "cancel": return .cancel
        case "destructive": return .destructive
        default: return nil
        }
    }
}

private struct SheetContent: View {
    let overlay: RenderOverlay
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: theme.space("md")) {
                    if let root = overlay.root {
                        SpectreNodeView(root)
                    }
                }
                .padding(theme.space("md"))
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle(overlay.props["title"]?.stringify() ?? "")
            .spectreInlineNavigationTitle()
        }
        .presentationDetents(detents)
    }

    private var detents: Set<PresentationDetent> {
        let tokens = (overlay.props["detents"]?.asArray ?? []).compactMap(\.asString)
        guard !tokens.isEmpty else { return [.large] }
        return Set(tokens.compactMap { token -> PresentationDetent? in
            switch token {
            case "small": return .fraction(0.25)
            case "medium": return .medium
            case "large": return .large
            default: return nil
            }
        })
    }
}
