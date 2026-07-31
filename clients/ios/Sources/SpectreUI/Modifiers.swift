import SwiftUI
import SpectreCore

/// ノードの `layout` / `style` を SwiftUI の修飾に写す。
///
/// 絶対座標指定は仕様上存在しない。表現できるのは padding / サイズ / 交差軸の配置
/// だけで、これは画面サイズとフォントスケールの差異に耐えるための意図的な制約
/// (docs/spec/schema.md §2.1)。
struct SpectreNodeModifier: ViewModifier {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    func body(content: Content) -> some View {
        content
            .modifier(SpectreLayoutModifier(node: node, theme: theme))
            .modifier(SpectreStyleModifier(node: node, theme: theme))
            .modifier(SpectreA11yModifier(node: node))
    }
}

private struct SpectreLayoutModifier: ViewModifier {
    let node: RenderNode
    let theme: SpectreTheme

    func body(content: Content) -> some View {
        var view = AnyView(content)

        if let ratio = node.layout["aspectRatio"]?.asDouble, ratio > 0 {
            view = AnyView(view.aspectRatio(ratio, contentMode: .fill))
        }

        // 幅・高さ。"fill" は無限大幅を与えて親いっぱいに広げる。
        let width = node.layout["width"]
        let height = node.layout["height"]
        if width != nil || height != nil {
            let fixedWidth = width?.asDouble.map { CGFloat($0) }
            let fixedHeight = height?.asDouble.map { CGFloat($0) }
            let fillWidth = width?.asString == "fill"
            let fillHeight = height?.asString == "fill"
            view = AnyView(
                view.frame(
                    maxWidth: fillWidth ? .infinity : fixedWidth,
                    maxHeight: fillHeight ? .infinity : fixedHeight,
                    alignment: .leading
                )
            )
        }

        // margin は外側 -> padding より後に適用する
        if let margin = edgeInsets(node.layout["margin"], theme) {
            view = AnyView(view.padding(margin))
        }
        return view
    }
}

private struct SpectreStyleModifier: ViewModifier {
    let node: RenderNode
    let theme: SpectreTheme

    func body(content: Content) -> some View {
        var view = AnyView(content)

        // padding は内側 -> 背景を塗る前に適用する
        if let padding = edgeInsets(node.layout["padding"], theme) {
            view = AnyView(view.padding(padding))
        }

        let radius = theme.corner(node.style["radius"]?.asString)
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)

        if let background = node.style["background"]?.asString,
           let color = theme.colors[background] {
            view = AnyView(view.background(shape.fill(color)))
        }

        if let border = node.style["border"]?.asObject,
           let colorToken = border["color"]?.asString,
           let color = theme.colors[colorToken] {
            let width = border["width"]?.asDouble ?? 1
            view = AnyView(view.overlay(shape.stroke(color, lineWidth: CGFloat(width))))
        }

        if radius > 0 {
            view = AnyView(view.clipShape(shape))
        }

        if let elevation = node.style["elevation"]?.asInt, elevation > 0 {
            view = AnyView(
                view.shadow(
                    color: .black.opacity(0.12),
                    radius: CGFloat(elevation) * 2,
                    y: CGFloat(elevation)
                )
            )
        }

        if let opacity = node.style["opacity"]?.asDouble {
            view = AnyView(view.opacity(opacity))
        }

        if let foreground = node.style["foreground"]?.asString,
           let color = theme.colors[foreground] {
            view = AnyView(view.foregroundStyle(color))
        }

        return view
    }
}

/// a11y の指定を SwiftUI のアクセシビリティ修飾に反映する。
///
/// ラベルが欠けているケースはエディタ側のリントで公開前に弾く前提だが、
/// SDK 側でも受け取った指定は必ず反映する。
private struct SpectreA11yModifier: ViewModifier {
    let node: RenderNode

    func body(content: Content) -> some View {
        if node.a11yHidden() {
            return AnyView(content.accessibilityHidden(true))
        }
        var view = AnyView(content)
        if let label = node.a11yLabel() {
            view = AnyView(view.accessibilityLabel(Text(label)))
        }
        if let hint = node.a11y["hint"], !hint.isNull {
            view = AnyView(view.accessibilityHint(Text(hint.stringify())))
        }
        if node.a11y["role"]?.asString == "header" {
            view = AnyView(view.accessibilityAddTraits(.isHeader))
        }
        return view
    }
}

/// SpacingToken 単体か `{top, leading, bottom, trailing}` のどちらかを受け取る。
private func edgeInsets(_ value: SpValue?, _ theme: SpectreTheme) -> EdgeInsets? {
    guard let value else { return nil }
    switch value {
    case .string(let token):
        guard token != "none" else { return nil }
        let v = theme.space(token)
        return EdgeInsets(top: v, leading: v, bottom: v, trailing: v)
    case .object(let entries):
        return EdgeInsets(
            top: theme.space(entries["top"]?.asString),
            leading: theme.space(entries["leading"]?.asString),
            bottom: theme.space(entries["bottom"]?.asString),
            trailing: theme.space(entries["trailing"]?.asString)
        )
    default:
        return nil
    }
}

extension View {
    /// layout / style / a11y をまとめて適用する。順序が意味を持つのでこの関数経由で使う。
    func spectreNode(_ node: RenderNode) -> some View {
        modifier(SpectreNodeModifier(node: node))
    }

    /// Stack の中でだけ意味を持つ `weight`。
    /// SwiftUI に weight がないため、`layoutPriority` + 伸長で近似する。
    @ViewBuilder
    func spectreWeight(_ node: RenderNode, axis: Axis) -> some View {
        if let weight = node.layout["weight"]?.asDouble, weight > 0 {
            switch axis {
            case .horizontal:
                self.frame(maxWidth: .infinity).layoutPriority(weight)
            case .vertical:
                self.frame(maxHeight: .infinity).layoutPriority(weight)
            }
        } else {
            self
        }
    }
}
