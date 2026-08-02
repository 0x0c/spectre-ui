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

/// オーバレイの見え方 (docs/spec/schema.md §3.1)。
///
/// `kind` が中身の形を、`presentation` が見え方を決める。省略時の既定は、この仕様が
/// 入る前のクライアントが描いていたものと一致させる — 古いドキュメントの見え方を
/// 変えないための約束 (ADR-0006)。
struct OverlayPresentation {
    enum Style: String { case sheet, fullScreen, dialog }

    let style: Style
    let dimBackground: Bool
    let dismissOnBackdrop: Bool
    let dragToDismiss: Bool

    init(_ overlay: RenderOverlay) {
        let dismissible = overlay.props["dismissible"]?.isTruthy ?? true
        let block = overlay.props["presentation"]?.asObject ?? [:]
        style = Style(rawValue: block["style"]?.asString ?? "") ?? .sheet
        dimBackground = block["dimBackground"]?.isTruthy ?? true
        dismissOnBackdrop = block["dismissOnBackdrop"]?.isTruthy ?? dismissible
        dragToDismiss = block["dragToDismiss"]?.isTruthy ?? dismissible
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
            let presentation = OverlayPresentation(overlay)
            switch overlay.kind {
            case .sheet:
                switch presentation.style {
                case .sheet:
                    view = AnyView(view.sheet(isPresented: binding(overlay.id, isVisible)) {
                        SheetContent(overlay: overlay)
                            .environmentObject(model)
                            .interactiveDismissDisabled(!presentation.dragToDismiss)
                    })
                case .fullScreen:
                    view = AnyView(view.spectreFullScreenCover(isPresented: binding(overlay.id, isVisible)) {
                        SheetContent(overlay: overlay, style: .fullScreen)
                            .environmentObject(model)
                            .interactiveDismissDisabled(!presentation.dragToDismiss)
                    })
                case .dialog:
                    // ダイアログ形式に相当する提示方法を SwiftUI は持たないので、スクリムと
                    // 中央のカードをレンダラ自身が描く。
                    view = AnyView(view.overlay {
                        if isVisible {
                            DialogContainer(presentation: presentation, onBackdropTap: { model.dismissOverlay(overlay.id) }) {
                                SheetContent(overlay: overlay, style: .dialog).environmentObject(model)
                            }
                        }
                    })
                }
            case .alert:
                // tone / icon / buttonLayout を指定したアラートは、システムの `.alert` では
                // 表現できない。その場合だけレンダラが描くダイアログに切り替える。
                if AlertDialogContent.needsCustomDialog(overlay) {
                    view = AnyView(view.overlay {
                        if isVisible {
                            DialogContainer(
                                presentation: presentation,
                                onBackdropTap: { model.dismissOverlay(overlay.id) }
                            ) {
                                AlertDialogContent(overlay: overlay).environmentObject(model)
                            }
                        }
                    })
                } else {
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
                }
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

/// スクリムと中央のカード。`presentation.style: "dialog"` と、装飾つきアラートで使う。
private struct DialogContainer<Content: View>: View {
    let presentation: OverlayPresentation
    let onBackdropTap: () -> Void
    @ViewBuilder let content: () -> Content

    @Environment(\.spectreTheme) private var theme

    var body: some View {
        ZStack {
            if presentation.dimBackground {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                    .onTapGesture { if presentation.dismissOnBackdrop { onBackdropTap() } }
                    .accessibilityHidden(true)
            }
            content()
                .frame(maxWidth: 420)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(theme.color("surface", default: Color.spectreSurface))
                )
                .shadow(radius: 24)
                .padding(theme.space("lg"))
        }
    }
}

/// `tone` / `icon` / `buttonLayout` を反映するアラートの中身 (docs/spec/schema.md §3.2)。
private struct AlertDialogContent: View {
    let overlay: RenderOverlay
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    /// システムの `.alert` が表現できない指定があるか。なければ従来どおりシステムに任せる。
    static func needsCustomDialog(_ overlay: RenderOverlay) -> Bool {
        overlay.props["tone"]?.asString != nil
            || overlay.props["icon"]?.asString != nil
            || (overlay.props["buttonLayout"]?.asString.map { $0 != "auto" } ?? false)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: theme.space("md")) {
            if let icon = overlay.props["icon"]?.asString {
                Image(systemName: theme.symbol(icon))
                    .resizable()
                    .scaledToFit()
                    .frame(width: 28, height: 28)
                    .foregroundStyle(toneColor)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .accessibilityHidden(true)
            }
            if let title = overlay.props["title"]?.asString {
                Text(title)
                    .font(theme.font("titleMd"))
                    .foregroundStyle(toneColor)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            if let message = overlay.props["message"]?.asString {
                Text(message)
                    .font(theme.font("bodyMd"))
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            buttons
        }
        .padding(theme.space("lg"))
    }

    @ViewBuilder
    private var buttons: some View {
        // `auto` はここには来ない (needsCustomDialog が false になる) が、tone だけを
        // 指定したアラートでは `auto` のまま届く。そのときは横並びを既定にする。
        if overlay.props["buttonLayout"]?.asString == "vertical" {
            VStack(spacing: theme.space("sm")) { buttonList }
        } else {
            HStack(spacing: theme.space("sm")) { buttonList }
        }
    }

    @ViewBuilder
    private var buttonList: some View {
        ForEach(overlay.buttons) { button in
            Button(button.label, role: button.role == "destructive" ? .destructive : nil) {
                model.dismissOverlay(overlay.id)
                model.dispatch(button.actions)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var toneColor: Color {
        switch overlay.props["tone"]?.asString {
        case "success": return theme.color("success", default: .green)
        case "warning": return theme.color("warning", default: .orange)
        case "error": return theme.color("error", default: .red)
        default: return theme.color("onSurface", default: .primary)
        }
    }
}

private struct SheetContent: View {
    let overlay: RenderOverlay
    /// 見え方 (docs/spec/schema.md §3.1)。detents はボトムシートにしか意味がなく、
    /// ダイアログではナビゲーションバーごと畳んで、中身の高さに収める。
    var style: OverlayPresentation.Style = .sheet
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        if style == .dialog {
            // ダイアログはカードの中に収まる大きさで描く。ここで NavigationStack を
            // 使うと、中身が小さくてもカードが画面いっぱいに広がってしまう。
            VStack(alignment: .leading, spacing: theme.space("md")) {
                if let title = overlay.props["title"]?.asString {
                    Text(title).font(theme.font("titleMd"))
                }
                tree
            }
            .padding(theme.space("md"))
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            NavigationStack {
                ScrollView {
                    tree
                        .padding(theme.space("md"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .navigationTitle(overlay.props["title"]?.stringify() ?? "")
                .spectreInlineNavigationTitle()
            }
            .spectreDetents(style == .sheet ? detents : nil)
        }
    }

    @ViewBuilder
    private var tree: some View {
        VStack(alignment: .leading, spacing: theme.space("md")) {
            if let root = overlay.root {
                SpectreNodeView(root)
            }
        }
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
