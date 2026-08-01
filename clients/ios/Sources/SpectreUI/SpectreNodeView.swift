import SwiftUI
import SpectreCore

/// 解決済みノードを描画する。
///
/// `RenderNode.type` は `Resolver` が対応済みであることを保証しているため、
/// ここに未知の型が来ることはない。それでも来た場合は何も描かない
/// (クラッシュしないことが不変条件)。
///
/// ノード型が実行時に決まるため `AnyView` で束ねている。
public struct SpectreNodeView: View {
    let node: RenderNode
    @EnvironmentObject private var model: SpectreScreenModel

    public init(_ node: RenderNode) {
        self.node = node
    }

    public var body: some View {
        Group {
            switch node.type {
            // レイアウト
            case "VStack": AnyView(VStackView(node: node))
            case "HStack": AnyView(HStackView(node: node))
            case "ZStack": AnyView(ZStackView(node: node))
            case "Spacer": AnyView(SpacerView(node: node))
            case "Divider": AnyView(DividerView(node: node))
            case "ScrollView": AnyView(ScrollViewView(node: node))
            case "List": AnyView(ListView(node: node))
            case "Grid": AnyView(GridView(node: node))
            case "Card": AnyView(CardView(node: node))
            case "Section": AnyView(SectionView(node: node))
            case "Tabs": AnyView(TabsView(node: node))

            // コンテンツ
            case "Text": AnyView(TextView(node: node))
            case "Image": AnyView(ImageView(node: node))
            case "Icon": AnyView(IconView(node: node))
            case "Badge": AnyView(BadgeView(node: node))
            case "ProgressIndicator": AnyView(ProgressIndicatorView(node: node))

            // 入力
            case "Button": AnyView(ButtonView(node: node))
            case "TextField": AnyView(TextFieldView(node: node))
            case "Toggle": AnyView(ToggleView(node: node))
            case "Checkbox": AnyView(CheckboxView(node: node))
            case "RadioGroup": AnyView(RadioGroupView(node: node))
            case "Select": AnyView(SelectView(node: node))
            case "Slider": AnyView(SliderView(node: node))
            case "Stepper": AnyView(StepperView(node: node))
            case "DatePicker": AnyView(DatePickerView(node: node))

            // Screen はルート専用。SpectreScreen が直接処理するのでここには来ない。
            default: AnyView(EmptyView())
            }
        }
        // `scrollTo` アクション (docs/spec/actions.md) の着地点。id を持つノードすべてに
        // 付けておき、ScreenContent の ScrollViewReader が id で見つけられるようにする。
        .modifier(SpectreScrollTargetID(nodeID: node.nodeID))
    }
}

private struct SpectreScrollTargetID: ViewModifier {
    let nodeID: String?

    func body(content: Content) -> some View {
        if let nodeID {
            content.id(nodeID)
        } else {
            content
        }
    }
}

/// 子ノードの列を描画する共通処理。
/// `RenderNode.id` は Resolver が安定キーから作っているので ForEach にそのまま渡せる。
struct SpectreChildren: View {
    let nodes: [RenderNode]

    var body: some View {
        ForEach(Array(nodes.enumerated()), id: \.offset) { _, child in
            SpectreNodeView(child)
        }
    }
}
