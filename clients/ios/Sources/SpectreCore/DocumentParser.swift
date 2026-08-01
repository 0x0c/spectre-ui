import Foundation

/// JSON テキスト -> `Document`。
///
/// ここでの責務は3つ。
/// 1. 構造の解釈 (ノード木・オーバレイ・アクション)
/// 2. マニフェスト由来の分類に従ったプロパティの振り分け (props / rawProps / nodeProps)
/// 3. 上限値の強制 — 不正なドキュメントを描画層に渡さない (docs/architecture.md §5)
///
/// 未知のコンポーネント型はここでは弾かない。劣化の判断は `Resolver` が
/// ケイパビリティに基づいて行うため、パース段階では素通しする。
public enum DocumentParser {

    public static func parse(text: String) throws -> Document {
        guard let data = text.data(using: .utf8) else {
            throw SpectreError.parse("UTF-8 として解釈できません")
        }
        guard data.count <= SpectreLimits.maxDocumentBytes else {
            throw SpectreError.limitExceeded(
                "ドキュメントが上限 \(SpectreLimits.maxDocumentBytes) バイトを超えています"
            )
        }
        let value = try SpValue.from(jsonData: data)
        guard case .object = value else {
            throw SpectreError.parse("ドキュメントのトップレベルはオブジェクトです")
        }
        return try parse(value: value)
    }

    public static func parse(value: SpValue) throws -> Document {
        guard let schemaVersion = value["schemaVersion"]?.asString else {
            throw SpectreError.parse("schemaVersion がありません")
        }
        guard let id = value["id"]?.asString else {
            throw SpectreError.parse("id がありません")
        }
        guard let rootValue = value["root"], case .object = rootValue else {
            throw SpectreError.parse("root がありません")
        }

        let counter = NodeCounter()
        let root = try parseNode(rootValue, counter, depth: 1)

        return Document(
            schemaVersion: schemaVersion,
            id: id,
            version: value["version"]?.asString,
            meta: parseMeta(value["meta"]),
            data: value["data"] ?? .emptyObject,
            state: value["state"] ?? .emptyObject,
            root: root,
            overlays: try (value["overlays"]?.asArray ?? []).compactMap {
                try parseOverlay($0, counter)
            },
            onAppear: value["onAppear"]?.asArray ?? [],
            onDisappear: value["onDisappear"]?.asArray ?? [],
            raw: value
        )
    }

    private static func parseMeta(_ value: SpValue?) -> DocumentMeta {
        guard let value, case .object = value else { return DocumentMeta() }
        let refresh = value["refresh"]
        return DocumentMeta(
            title: value["title"]?.asString,
            statePolicy: value["statePolicy"]?.asString == "preserve" ? .preserve : .reset,
            pullToRefresh: refresh?["pullToRefresh"]?.asBool ?? false,
            refreshIntervalSec: refresh?["intervalSec"]?.asInt
        )
    }

    private final class NodeCounter {
        var count = 0
        func tick() throws {
            count += 1
            if count > SpectreLimits.maxNodes {
                throw SpectreError.limitExceeded("ノード数が上限 \(SpectreLimits.maxNodes) を超えています")
            }
        }
    }

    private static func parseNode(_ value: SpValue, _ counter: NodeCounter, depth: Int) throws -> Node {
        try counter.tick()
        guard depth <= SpectreLimits.maxDepth else {
            throw SpectreError.limitExceeded("ノードの深さが上限 \(SpectreLimits.maxDepth) を超えています")
        }
        guard let type = value["type"]?.asString else {
            throw SpectreError.parse("ノードに type がありません")
        }

        let spec = GeneratedCatalog.spec(type)
        let split = try splitProps(value["props"] ?? .emptyObject, spec, counter, depth)

        var children: [Node] = []
        for child in value["children"]?.asArray ?? [] where child.asObject != nil {
            children.append(try parseNode(child, counter, depth: depth + 1))
        }

        var repeatSpec: RepeatSpec?
        if let raw = value["repeat"], raw.asObject != nil {
            repeatSpec = try parseRepeat(raw, counter, depth)
        }

        var fallback: Node?
        if let raw = value["fallback"], raw.asObject != nil {
            fallback = try parseNode(raw, counter, depth: depth)
        }

        return Node(
            type: type,
            id: value["id"]?.asString,
            props: split.props,
            rawProps: split.rawProps,
            nodeProps: split.nodeProps,
            children: children,
            layout: value["layout"]?.asObject ?? [:],
            style: value["style"]?.asObject ?? [:],
            a11y: value["a11y"]?.asObject ?? [:],
            visibleWhen: value["visibleWhen"]?.asString,
            repeatSpec: repeatSpec,
            fallback: fallback,
            optional: value["optional"]?.asBool ?? false
        )
    }

    private static func parseRepeat(
        _ value: SpValue,
        _ counter: NodeCounter,
        _ depth: Int
    ) throws -> RepeatSpec? {
        guard let forExpression = value["for"]?.asString else { return nil }
        var emptyView: Node?
        if let raw = value["emptyView"], raw.asObject != nil {
            emptyView = try parseNode(raw, counter, depth: depth + 1)
        }
        return RepeatSpec(
            forExpression: forExpression,
            asName: value["as"]?.asString ?? "item",
            indexName: value["indexAs"]?.asString ?? "index",
            key: value["key"]?.asString,
            limit: value["limit"]?.asInt,
            emptyView: emptyView
        )
    }

    private static func parseOverlay(_ value: SpValue, _ counter: NodeCounter) throws -> Overlay? {
        guard let id = value["id"]?.asString,
              let kindText = value["kind"]?.asString,
              let kind = OverlayKind(rawValue: kindText) else { return nil }

        let reserved: Set<String> = ["id", "kind", "root", "buttons"]
        var root: Node?
        if let raw = value["root"], raw.asObject != nil {
            root = try parseNode(raw, counter, depth: 1)
        }

        let buttons: [OverlayButton] = (value["buttons"]?.asArray ?? []).compactMap { raw in
            guard let label = raw["label"]?.asString else { return nil }
            return OverlayButton(
                label: label,
                role: raw["role"]?.asString ?? "default",
                actions: raw["actions"]?.asArray ?? []
            )
        }

        return Overlay(
            id: id,
            kind: kind,
            props: (value.asObject ?? [:]).filter { !reserved.contains($0.key) },
            root: root,
            buttons: buttons
        )
    }

    // MARK: - プロパティの振り分け

    private struct SplitProps {
        let props: [String: SpValue]
        let rawProps: [String: SpValue]
        let nodeProps: [String: [Node]]
    }

    /// マニフェスト由来の分類 (`ComponentSpec`) に従ってプロパティを3つに分ける。
    ///
    /// 未知のコンポーネント (spec == nil) では振り分けができないので、すべてを
    /// `Node.props` に残す。未知ノードは `Resolver` が fallback へ置換するため、
    /// ここで捨ててしまうと fallback の解決に必要な情報まで失われる。
    private static func splitProps(
        _ source: SpValue,
        _ spec: ComponentSpec?,
        _ counter: NodeCounter,
        _ depth: Int
    ) throws -> SplitProps {
        let entries = source.asObject ?? [:]
        guard let spec else { return SplitProps(props: entries, rawProps: [:], nodeProps: [:]) }

        // 未知のプロパティキーは黙って無視する (docs/compatibility.md §3)
        var remaining = SpValue.object(entries.filter { spec.propNames.contains($0.key) })
        var rawProps: [String: SpValue] = [:]
        var nodeProps: [String: [Node]] = [:]

        for path in spec.actionPaths {
            let (rest, extracted) = takePath(remaining, PathSpec(path))
            remaining = rest
            if let extracted { rawProps[path] = extracted }
        }

        for path in spec.nodePaths {
            let pathSpec = PathSpec(path)
            let (rest, extracted) = takePath(remaining, pathSpec)
            remaining = rest
            guard let extracted else { continue }
            var nodes: [Node] = []
            if pathSpec.isArray {
                for item in extracted.asArray ?? [] where item.asObject != nil {
                    nodes.append(try parseNode(item, counter, depth: depth + 1))
                }
            } else if extracted.asObject != nil {
                nodes.append(try parseNode(extracted, counter, depth: depth + 1))
            }
            if !nodes.isEmpty { nodeProps[path] = nodes }
        }

        return SplitProps(
            props: remaining.asObject ?? [:],
            rawProps: rawProps,
            nodeProps: nodeProps
        )
    }

    private struct PathSpec {
        let segments: [String]
        let isArray: Bool

        init(_ path: String) {
            isArray = path.hasSuffix("[]")
            let clean = isArray ? String(path.dropLast(2)) : path
            segments = clean.split(separator: ".").map(String.init)
        }
    }

    /// ドット区切りのパスにある値を取り出し、「取り出した値」と「残りの構造」を返す。
    ///
    /// `Screen.appBar` のようにオブジェクトの内側にノードがある場合、appBar 自体は
    /// props に残しつつ appBar.actions だけを nodeProps へ移す必要があるため、
    /// 単純な削除ではなく分離になっている。
    private static func takePath(_ container: SpValue, _ spec: PathSpec) -> (SpValue, SpValue?) {
        takeSegments(container, spec.segments, 0)
    }

    private static func takeSegments(
        _ container: SpValue,
        _ segments: [String],
        _ index: Int
    ) -> (SpValue, SpValue?) {
        if index >= segments.count { return (.null, container) }
        guard var entries = container.asObject else { return (container, nil) }
        let key = segments[index]
        guard let child = entries[key] else { return (container, nil) }

        let (childRemaining, extracted) = takeSegments(child, segments, index + 1)
        guard let extracted else { return (container, nil) }

        if childRemaining.isNull { entries.removeValue(forKey: key) } else { entries[key] = childRemaining }
        return (.object(entries), extracted)
    }
}
