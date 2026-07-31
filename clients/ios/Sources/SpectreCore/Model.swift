import Foundation

/// 未解決のドキュメント。式文字列をそのまま保持している。
/// 描画用の木を得るには `Resolver` を通す。
public struct Document: Sendable {
    public let schemaVersion: String
    public let id: String
    public let version: String?
    public let meta: DocumentMeta
    public let data: SpValue
    public let state: SpValue
    public let root: Node
    public let overlays: [Overlay]
    public let onAppear: [SpValue]
    public let onDisappear: [SpValue]

    public init(
        schemaVersion: String,
        id: String,
        version: String? = nil,
        meta: DocumentMeta = DocumentMeta(),
        data: SpValue = .emptyObject,
        state: SpValue = .emptyObject,
        root: Node,
        overlays: [Overlay] = [],
        onAppear: [SpValue] = [],
        onDisappear: [SpValue] = []
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.version = version
        self.meta = meta
        self.data = data
        self.state = state
        self.root = root
        self.overlays = overlays
        self.onAppear = onAppear
        self.onDisappear = onDisappear
    }
}

public struct DocumentMeta: Sendable {
    public let title: String?
    public let statePolicy: StatePolicy
    public let pullToRefresh: Bool
    public let refreshIntervalSec: Int?

    public init(
        title: String? = nil,
        statePolicy: StatePolicy = .reset,
        pullToRefresh: Bool = false,
        refreshIntervalSec: Int? = nil
    ) {
        self.title = title
        self.statePolicy = statePolicy
        self.pullToRefresh = pullToRefresh
        self.refreshIntervalSec = refreshIntervalSec
    }
}

public enum StatePolicy: Sendable { case reset, preserve }

/// 未解決のノード。
///
/// プロパティを3つに分けているのは、解決時の扱いが異なるため。
/// - `props`     … 式として解決する
/// - `rawProps`  … 解決しない。アクションはディスパッチ時に評価されるため
///                 (`${state.qty + 1}` は「タップした時点の state」を見る必要がある)
/// - `nodeProps` … 子ノードとして再帰的に解決する
///
/// この振り分けは `GeneratedCatalog` がコンポーネントマニフェストから生成する。
public struct Node: Sendable {
    public let type: String
    public let id: String?
    public let props: [String: SpValue]
    public let rawProps: [String: SpValue]
    public let nodeProps: [String: [Node]]
    public let children: [Node]
    public let layout: [String: SpValue]
    public let style: [String: SpValue]
    public let a11y: [String: SpValue]
    public let visibleWhen: String?
    public let repeatSpec: RepeatSpec?
    public let fallback: Node?
    public let optional: Bool

    public init(
        type: String,
        id: String? = nil,
        props: [String: SpValue] = [:],
        rawProps: [String: SpValue] = [:],
        nodeProps: [String: [Node]] = [:],
        children: [Node] = [],
        layout: [String: SpValue] = [:],
        style: [String: SpValue] = [:],
        a11y: [String: SpValue] = [:],
        visibleWhen: String? = nil,
        repeatSpec: RepeatSpec? = nil,
        fallback: Node? = nil,
        optional: Bool = false
    ) {
        self.type = type
        self.id = id
        self.props = props
        self.rawProps = rawProps
        self.nodeProps = nodeProps
        self.children = children
        self.layout = layout
        self.style = style
        self.a11y = a11y
        self.visibleWhen = visibleWhen
        self.repeatSpec = repeatSpec
        self.fallback = fallback
        self.optional = optional
    }

    /// repeat を取り除いたコピー。各要素のスコープで解決するときに使う。
    func withoutRepeat() -> Node {
        Node(
            type: type, id: id, props: props, rawProps: rawProps, nodeProps: nodeProps,
            children: children, layout: layout, style: style, a11y: a11y,
            visibleWhen: visibleWhen, repeatSpec: nil, fallback: fallback, optional: optional
        )
    }
}

public struct RepeatSpec: Sendable {
    public let forExpression: String
    public let asName: String
    public let indexName: String
    public let key: String?
    public let limit: Int?
    public let emptyView: Node?

    public init(
        forExpression: String,
        asName: String = "item",
        indexName: String = "index",
        key: String? = nil,
        limit: Int? = nil,
        emptyView: Node? = nil
    ) {
        self.forExpression = forExpression
        self.asName = asName
        self.indexName = indexName
        self.key = key
        self.limit = limit
        self.emptyView = emptyView
    }
}

public struct Overlay: Sendable {
    public let id: String
    public let kind: OverlayKind
    public let props: [String: SpValue]
    public let root: Node?
    public let buttons: [OverlayButton]

    public init(
        id: String,
        kind: OverlayKind,
        props: [String: SpValue] = [:],
        root: Node? = nil,
        buttons: [OverlayButton] = []
    ) {
        self.id = id
        self.kind = kind
        self.props = props
        self.root = root
        self.buttons = buttons
    }
}

public enum OverlayKind: String, Sendable { case sheet, alert, toast }

public struct OverlayButton: Sendable {
    public let label: String
    public let role: String
    public let actions: [SpValue]

    public init(label: String, role: String = "default", actions: [SpValue] = []) {
        self.label = label
        self.role = role
        self.actions = actions
    }
}

// MARK: - 解決済みの描画木

/// 式が解決され、未対応コンポーネントの劣化処理も済んだ描画用ノード。
///
/// レンダラはこの型しか見ない。分岐も式評価も持たないため、iOS/Android の
/// レンダラ実装を薄く保てる (docs/architecture.md §2)。
public struct RenderNode: Identifiable, Sendable {
    public let type: String
    public let nodeID: String?
    /// repeat の要素を区別する安定キー。差分描画に使う。
    public let key: String?
    public let props: [String: SpValue]
    public let rawProps: [String: SpValue]
    public let nodeProps: [String: [RenderNode]]
    public let children: [RenderNode]
    public let layout: [String: SpValue]
    public let style: [String: SpValue]
    public let a11y: [String: SpValue]

    /// SwiftUI の ForEach 用。安定キーがなければ型と位置から作る。
    public let id: String

    public init(
        type: String,
        nodeID: String? = nil,
        key: String? = nil,
        props: [String: SpValue] = [:],
        rawProps: [String: SpValue] = [:],
        nodeProps: [String: [RenderNode]] = [:],
        children: [RenderNode] = [],
        layout: [String: SpValue] = [:],
        style: [String: SpValue] = [:],
        a11y: [String: SpValue] = [:],
        id: String? = nil
    ) {
        self.type = type
        self.nodeID = nodeID
        self.key = key
        self.props = props
        self.rawProps = rawProps
        self.nodeProps = nodeProps
        self.children = children
        self.layout = layout
        self.style = style
        self.a11y = a11y
        self.id = id ?? key ?? nodeID ?? type
    }

    public func prop(_ name: String) -> SpValue { props[name] ?? .null }
    public func actions(_ name: String) -> [SpValue] { rawProps[name]?.asArray ?? [] }
    public func nodes(_ name: String) -> [RenderNode] { nodeProps[name] ?? [] }
    public func node(_ name: String) -> RenderNode? { nodeProps[name]?.first }
}

public struct RenderOverlay: Identifiable, Sendable {
    public let id: String
    public let kind: OverlayKind
    public let props: [String: SpValue]
    public let root: RenderNode?
    public let buttons: [RenderOverlayButton]
}

public struct RenderOverlayButton: Identifiable, Sendable {
    public let id: String
    public let label: String
    public let role: String
    public let actions: [SpValue]
}

/// 解決の結果と、その過程で起きた劣化・エラーの記録。
public struct ResolveResult: Sendable {
    public let root: RenderNode?
    public let overlays: [RenderOverlay]
    public let degradations: [Degradation]
    public let exprErrors: [String]
}

/// 未対応コンポーネントに遭遇したときの劣化の記録。
///
/// これを集計して「このコンポーネントは現在のユーザの何%で劣化するか」を
/// 実測し、エディタに還流させる (docs/compatibility.md §6)。
public struct Degradation: Sendable, Equatable {
    public let nodeType: String
    public let nodeID: String?
    public let degradedTo: DegradedTo
    /// ドキュメント側が `optional: true` で「無くてもよい」と宣言していたか。
    public let intentional: Bool
}

public enum DegradedTo: String, Sendable {
    case fallback
    case omitted
}
