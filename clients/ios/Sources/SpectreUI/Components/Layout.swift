import SwiftUI
import SpectreCore

struct VStackView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        VStack(
            alignment: horizontalAlignmentOf(node.token("alignment", default: "leading")),
            spacing: theme.space(node.token("spacing", default: "none"))
        ) {
            SpectreChildren(nodes: node.children)
        }
        .spectreNode(node)
    }
}

struct HStackView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        HStack(
            alignment: verticalAlignmentOf(node.token("alignment", default: "center")),
            spacing: theme.space(node.token("spacing", default: "none"))
        ) {
            // distribution: spaceBetween は要素の間に Spacer を挟んで表現する
            if node.token("distribution", default: "packed") == "spaceBetween" {
                ForEach(Array(node.children.enumerated()), id: \.offset) { index, child in
                    SpectreNodeView(child)
                    if index != node.children.count - 1 { Spacer(minLength: 0) }
                }
            } else {
                SpectreChildren(nodes: node.children)
            }
        }
        .spectreNode(node)
    }
}

struct ZStackView: View {
    let node: RenderNode

    var body: some View {
        ZStack(alignment: stackAlignmentOf(node.token("alignment", default: "center"))) {
            SpectreChildren(nodes: node.children)
        }
        .spectreNode(node)
    }
}

struct SpacerView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        if let token = node.tokenOrNil("minLength") {
            Spacer(minLength: theme.space(token))
        } else {
            Spacer()
        }
    }
}

struct DividerView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let color = theme.color(node.token("color", default: "outlineVariant"), default: .gray)
        let inset = theme.space(node.token("inset", default: "none"))
        if node.token("orientation", default: "horizontal") == "vertical" {
            Divider().overlay(color).padding(.vertical, inset)
        } else {
            Divider().overlay(color).padding(.horizontal, inset)
        }
    }
}

struct ScrollViewView: View {
    let node: RenderNode

    var body: some View {
        let horizontal = node.token("direction", default: "vertical") == "horizontal"
        ScrollView(
            horizontal ? .horizontal : .vertical,
            showsIndicators: node.bool("showsIndicator", default: true)
        ) {
            if horizontal {
                HStack(spacing: 0) { SpectreChildren(nodes: node.children) }
            } else {
                VStack(spacing: 0) { SpectreChildren(nodes: node.children) }
            }
        }
        .spectreNode(node)
    }
}

/// 縦方向のコレクション。
///
/// SwiftUI では `LazyVStack` をスクロールしない文脈に置いても壊れないため、
/// Compose 側のような遅延/非遅延の切り替えは不要。ただし親がスクロールを
/// 提供していないと遅延化の効果は出ない。
struct ListView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let spacing = theme.space(node.token("spacing", default: "none"))
        let separator = node.bool("separator", default: false)

        LazyVStack(alignment: .leading, spacing: spacing) {
            if let header = node.node("header") { SpectreNodeView(header) }
            ForEach(Array(node.children.enumerated()), id: \.offset) { index, child in
                SpectreNodeView(child)
                if separator && index != node.children.count - 1 { Divider() }
            }
            if let footer = node.node("footer") { SpectreNodeView(footer) }
        }
        .spectreNode(node)
    }
}

struct GridView: View {
    let node: RenderNode
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let spacing = theme.space(node.token("spacing", default: "sm"))
        let columnCount = min(max(node.int("columns", default: 2), 1), 4)
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: spacing, alignment: .top),
            count: columnCount
        )
        LazyVGrid(columns: columns, spacing: spacing) {
            SpectreChildren(nodes: node.children)
        }
        .spectreNode(node)
    }
}

struct CardView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let onTap = node.actions("onTap")
        let padding = theme.space(node.token("padding", default: "md"))
        let radius = theme.corner(node.token("radius", default: "md"))
        let elevation = min(max(node.int("elevation", default: 1), 0), 3)

        let content = VStack(alignment: .leading, spacing: 0) {
            SpectreChildren(nodes: node.children)
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(theme.color("surface", default: Color(.secondarySystemBackground)))
        )
        .shadow(color: .black.opacity(elevation > 0 ? 0.10 : 0), radius: CGFloat(elevation) * 2, y: CGFloat(elevation))

        if onTap.isEmpty {
            content.spectreNode(node)
        } else {
            Button { model.dispatch(onTap) } label: { content }
                .buttonStyle(.plain)
                .spectreNode(node)
        }
    }
}

struct SectionView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let title = node.stringOrNil("title")
        let subtitle = node.stringOrNil("subtitle")
        let action = node.props["action"]?.asObject
        let actionLabel = action?["label"]?.stringify()

        VStack(alignment: .leading, spacing: theme.space("sm")) {
            if title != nil || actionLabel != nil {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let title {
                            Text(title)
                                .font(theme.font("titleSm"))
                                .accessibilityAddTraits(.isHeader)
                        }
                        if let subtitle {
                            Text(subtitle)
                                .font(theme.font("bodySm"))
                                .foregroundStyle(theme.color("onSurfaceVariant", default: .secondary))
                        }
                    }
                    Spacer(minLength: 0)
                    if let actionLabel {
                        Button(actionLabel) { model.dispatch(node.actions("action.actions")) }
                    }
                }
            }
            SpectreChildren(nodes: node.children)
        }
        .spectreNode(node)
    }
}

struct TabsView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel
    @Environment(\.spectreTheme) private var theme

    var body: some View {
        let items = node.tabItems()
        if items.isEmpty {
            EmptyView()
        } else {
            let bindTo = node.stringOrNil("bindTo")
            let selectedID = bindTo.map { model.stateValue($0).stringify() }
            let selectedIndex = items.firstIndex { $0.id == selectedID } ?? 0

            VStack(alignment: .leading, spacing: theme.space("sm")) {
                Picker("", selection: Binding(
                    get: { selectedIndex },
                    set: { newIndex in
                        guard let bindTo, newIndex < items.count else { return }
                        model.setStateValue(bindTo, .string(items[newIndex].id))
                        model.dispatch(node.actions("onChange"))
                    }
                )) {
                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        Text(item.label).tag(index)
                    }
                }
                .pickerStyle(.segmented)

                // children[i] が items[i] の内容に対応する
                if selectedIndex < node.children.count {
                    SpectreNodeView(node.children[selectedIndex])
                }
            }
            .spectreNode(node)
        }
    }
}
