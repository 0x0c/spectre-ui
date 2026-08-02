import SwiftUI
import SpectreCore

struct TextView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        // 数値がそのまま来ることがある (単独の式は型が保存される) ので string() で文字列化する
        var text = Text(node.string("text"))
        if let weight = fontWeightOf(node.token("weight", default: "regular")) {
            text = text.fontWeight(weight)
        }
        switch node.token("decoration", default: "none") {
        case "underline": text = text.underline()
        case "strikethrough": text = text.strikethrough()
        default: break
        }

        return text
            .font(theme.font(node.token("typography", default: "bodyMd")))
            .foregroundStyle(theme.color(node.token("color", default: "onSurface"), default: .primary))
            .multilineTextAlignment(textAlignmentOf(node.token("align", default: "start")))
            .lineLimit(node.intOrNil("maxLines"))
            .truncationMode(node.token("truncation", default: "tail") == "middle" ? .middle : .tail)
            .modifier(TextSelectionModifier(selectable: node.bool("selectable", default: false)))
            .frame(maxWidth: .infinity, alignment: frameAlignmentOf(node.token("align", default: "start")))
            .spectreNode(node)
    }
}

struct ImageView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let radius = theme.corner(node.token("radius", default: "none"))
        let placeholderColor = theme.color("surfaceVariant", default: Color.spectreFill)

        // v0.1 は SwiftUI 標準の AsyncImage を使う。ディスクキャッシュと
        // 優先度制御が要るようになったら Nuke へ差し替える (ADR-0001 の想定)。
        AsyncImage(url: URL(string: node.string("url"))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: contentModeOf(node.token("contentMode", default: "fill")))
            case .failure:
                placeholderColor.overlay(
                    Image(systemName: "photo").foregroundStyle(.secondary)
                )
            default:
                placeholderColor
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        // 装飾画像はスクリーンリーダから隠す
        .accessibilityHidden(node.bool("decorative", default: false))
        .spectreNode(node)
    }
}

struct IconView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    /// body に明示的な return が無いと @ViewBuilder が適用され、代入文が
    /// View 式として解釈されてしまう。寸法の決定は body の外に出す。
    private var size: CGFloat {
        switch node.token("size", default: "md") {
        case "sm": return 16
        case "lg": return 32
        default: return 24
        }
    }

    var body: some View {
        Image(systemName: theme.symbol(node.token("name", default: "")))
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .foregroundStyle(theme.color(node.token("color", default: "onSurface"), default: .primary))
            .spectreNode(node)
    }
}

struct BadgeView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let tone = node.token("tone", default: "neutral")
        let outlined = node.token("variant", default: "filled") == "outlined"

        let container: Color
        let content: Color
        switch tone {
        case "info":
            container = theme.color("info", default: .blue)
            content = theme.color("onInfo", default: .white)
        case "success":
            container = theme.color("success", default: .green)
            content = theme.color("onSuccess", default: .white)
        case "warning":
            container = theme.color("warning", default: .orange)
            content = theme.color("onWarning", default: .black)
        case "error":
            container = theme.color("error", default: .red)
            content = theme.color("onError", default: .white)
        default:
            container = theme.color("surfaceVariant", default: Color.spectreFill)
            content = theme.color("onSurfaceVariant", default: .secondary)
        }

        let shape = RoundedRectangle(cornerRadius: theme.corner("sm"), style: .continuous)

        return Text(node.string("text"))
            .font(theme.font("caption"))
            .foregroundStyle(outlined ? container : content)
            .padding(.horizontal, theme.space("sm"))
            .padding(.vertical, 2)
            .background {
                if outlined { shape.stroke(container, lineWidth: 1) } else { shape.fill(container) }
            }
            .spectreNode(node)
    }
}

struct ProgressIndicatorView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let value = node.doubleOrNil("value")
        let linear = node.token("kind", default: "circular") == "linear"

        // ProgressViewStyle は静的型なので、型消去せず呼び出し側で分岐する。
        Group {
            switch (linear, value) {
            case (true, .some(let v)):
                ProgressView(value: min(max(v, 0), 1)).progressViewStyle(.linear)
            case (true, .none):
                ProgressView().progressViewStyle(.linear)
            case (false, .some(let v)):
                ProgressView(value: min(max(v, 0), 1)).progressViewStyle(.circular)
            case (false, .none):
                ProgressView().progressViewStyle(.circular)
            }
        }
        .tint(theme.color("primary", default: .accentColor))
        .spectreNode(node)
    }
}

/// 未対応コンポーネントの劣化の最終手段 (docs/compatibility.md §3, ADR-0006)。
///
/// `RenderNode.placeholderType` に対して描く汎用プレースホルダ。省略と違って画面上に
/// 痕跡を残すことで、「何かが表示されないまま失われた」ことを利用者・ホストアプリの
/// どちらから見ても分かるようにする。`componentType` prop に元の未知の型名を積んでいる
/// (`Resolver` 参照)。
struct UnsupportedComponentView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let outline = theme.color("outline", default: Color.spectreSeparator)
        let label = node.a11yLabel() ?? "表示できないコンテンツです (\(node.string("componentType", default: "unknown")))"

        ZStack {
            Image(systemName: theme.symbol("warning"))
                .foregroundStyle(outline)
        }
        .frame(minWidth: 32, minHeight: 32)
        .padding(theme.space("sm"))
        .overlay(
            RoundedRectangle(cornerRadius: theme.corner("sm"), style: .continuous)
                .stroke(outline, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .spectreNode(node)
    }
}

/// テキスト選択の可否。
///
/// `.enabled` と `.disabled` は別々の型 (`EnabledTextSelectability` /
/// `DisabledTextSelectability`) なので三項演算子では選べない。分岐で切り替える。
private struct TextSelectionModifier: ViewModifier {
    let selectable: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if selectable {
            content.textSelection(.enabled)
        } else {
            content.textSelection(.disabled)
        }
    }
}
