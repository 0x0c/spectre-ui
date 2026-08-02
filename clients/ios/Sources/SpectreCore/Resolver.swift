import Foundation

/// 未解決のドキュメント + 状態 -> 描画用の `RenderNode` 木。
///
/// ここで以下をすべて済ませるため、レンダラは分岐も式評価も持たずに済む。
/// - 式とテンプレートの解決
/// - `visibleWhen` による木からの除外
/// - `repeat` の展開
/// - 未対応コンポーネントの劣化 (fallback / 省略)
///
/// レンダラが未知の型を目にすることはない (docs/architecture.md §2)。
public final class Resolver {
    private let templates: TemplateEvaluator
    /// このクライアントが解釈できるコンポーネント名。
    /// ホストアプリが一部を無効化できるよう、カタログ全体とは別に受け取る。
    private let supportedComponents: Set<String>

    public init(
        templates: TemplateEvaluator = TemplateEvaluator(),
        supportedComponents: Set<String> = GeneratedCatalog.componentNames
    ) {
        self.templates = templates
        self.supportedComponents = supportedComponents
    }

    public func resolve(_ document: Document, scope: EvalScope) -> ResolveResult {
        var ctx = Context()
        let roots = resolveNode(document.root, scope, &ctx)
        let overlays = document.overlays.map { resolveOverlay($0, scope, &ctx) }
        return ResolveResult(
            root: roots.first,
            overlays: overlays,
            degradations: ctx.degradations,
            exprErrors: ctx.errors
        )
    }

    private struct Context {
        var degradations: [Degradation] = []
        var errors: [String] = []
    }

    private func resolveOverlay(
        _ overlay: Overlay,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> RenderOverlay {
        RenderOverlay(
            id: overlay.id,
            kind: overlay.kind,
            props: resolveValues(overlay.props, scope, &ctx),
            root: overlay.root.flatMap { resolveNode($0, scope, &ctx).first },
            buttons: overlay.buttons.enumerated().map { index, button in
                RenderOverlayButton(
                    id: "\(overlay.id)-\(index)",
                    label: evaluate(button.label, scope, &ctx).stringify(),
                    role: button.role,
                    actions: button.actions
                )
            }
        )
    }

    /// 1つの `Node` は 0個以上の `RenderNode` になる。
    /// - `visibleWhen` が偽 / 未対応で省略 -> 0個
    /// - `repeat` -> 要素数ぶん
    private func resolveNode(
        _ node: Node,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> [RenderNode] {
        // 1. repeat は最初に展開する。visibleWhen は展開後の各要素に対して評価される。
        if let repeatSpec = node.repeatSpec {
            return expandRepeat(node, repeatSpec, scope, &ctx)
        }

        // 2. 可視性。除外されたノードは劣化の集計対象にもしない。
        if let condition = node.visibleWhen, !evaluate(condition, scope, &ctx).isTruthy {
            return []
        }

        // 3. ケイパビリティによる劣化
        guard supportedComponents.contains(node.type) else {
            return degrade(node, scope, &ctx)
        }

        // 4. 実際の解決
        return [resolveSupported(node, scope, &ctx, key: nil, index: nil)]
    }

    private func resolveSupported(
        _ node: Node,
        _ scope: EvalScope,
        _ ctx: inout Context,
        key: String?,
        index: Int?
    ) -> RenderNode {
        var resolvedNodeProps: [String: [RenderNode]] = [:]
        for (path, nodes) in node.nodeProps {
            let resolved = nodes.flatMap { resolveNode($0, scope, &ctx) }
            if !resolved.isEmpty { resolvedNodeProps[path] = resolved }
        }

        var children: [RenderNode] = []
        for child in node.children {
            children.append(contentsOf: resolveNode(child, scope, &ctx))
        }

        return RenderNode(
            type: node.type,
            nodeID: node.id,
            key: key,
            props: resolveValues(node.props, scope, &ctx),
            // アクションは解決しない。タップ時点の state を見る必要があるため、
            // 式は文字列のまま保持してディスパッチ時に評価する。
            rawProps: node.rawProps,
            nodeProps: resolvedNodeProps,
            children: children,
            layout: resolveValues(node.layout, scope, &ctx),
            style: resolveValues(node.style, scope, &ctx),
            a11y: resolveValues(node.a11y, scope, &ctx),
            id: key ?? node.id ?? (index.map { "\(node.type)#\($0)" } ?? node.type)
        )
    }

    /// 未対応コンポーネントの劣化 (docs/compatibility.md §3, ADR-0006)。
    ///
    /// fallback -> optional による省略 -> プレースホルダ の順に落ちる。
    /// どの経路でもクラッシュしないことが不変条件。
    ///
    /// `key` は `repeat` 展開中の要素だけが持つ安定キー (`expandRepeat` 経由)。
    /// fallback やプレースホルダに落ちても要素の同一性が保てるよう引き継ぐ。
    private func degrade(
        _ node: Node,
        _ scope: EvalScope,
        _ ctx: inout Context,
        key: String? = nil
    ) -> [RenderNode] {
        if let fallback = node.fallback {
            ctx.degradations.append(
                Degradation(nodeType: node.type, nodeID: node.id, degradedTo: .fallback, intentional: false)
            )
            // fallback 自体が未対応なら、その fallback へと再帰的に落ちていく。
            let resolved = resolveNode(fallback, scope, &ctx)
            // fallback がちょうど1ノードに解決された場合だけキーを引き継ぐ — fallback 自身が
            // repeat や visibleWhen を持ち0件/複数件になるケースは単一の安定キーを持てない。
            guard let key, resolved.count == 1 else { return resolved }
            return [withRepeatKey(resolved[0], key)]
        }
        if node.optional {
            ctx.degradations.append(
                Degradation(nodeType: node.type, nodeID: node.id, degradedTo: .omitted, intentional: true)
            )
            return []
        }
        // 必須 (optional でない) かつ fallback もない — 黙って省略すると
        // 「何かが表示されないまま失われた」ことが誰にも見えなくなる。最終手段として
        // 汎用プレースホルダに置き換える。layout/style/a11y は型に依存しない共通の
        // フィールドなので、未知の型でも解決して引き継げる (レイアウトの穴を防ぐ)。
        ctx.degradations.append(
            Degradation(nodeType: node.type, nodeID: node.id, degradedTo: .placeholder, intentional: false)
        )
        return [
            RenderNode(
                type: RenderNode.placeholderType,
                nodeID: node.id,
                key: key,
                props: ["componentType": .string(node.type)],
                layout: resolveValues(node.layout, scope, &ctx),
                style: resolveValues(node.style, scope, &ctx),
                a11y: resolveValues(node.a11y, scope, &ctx)
            )
        ]
    }

    /// [degrade] が repeat 要素の fallback 結果へ安定キーを付け直すための複製。
    private func withRepeatKey(_ node: RenderNode, _ key: String) -> RenderNode {
        RenderNode(
            type: node.type,
            nodeID: node.nodeID,
            key: key,
            props: node.props,
            rawProps: node.rawProps,
            nodeProps: node.nodeProps,
            children: node.children,
            layout: node.layout,
            style: node.style,
            a11y: node.a11y,
            id: key
        )
    }

    private func expandRepeat(
        _ node: Node,
        _ repeatSpec: RepeatSpec,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> [RenderNode] {
        let source = evaluate(repeatSpec.forExpression, scope, &ctx)
        guard let items = source.asArray, !items.isEmpty else {
            // 配列でない場合も 0 件として扱う。式が壊れていても画面は壊れない。
            guard let emptyView = repeatSpec.emptyView else { return [] }
            return resolveNode(emptyView, scope, &ctx)
        }

        let limit = min(repeatSpec.limit ?? SpectreLimits.maxRepeatItems, SpectreLimits.maxRepeatItems)
        if items.count > limit {
            ctx.errors.append("repeat の件数 \(items.count) が上限 \(limit) を超えたため切り詰めました")
        }

        let template = node.withoutRepeat()
        let condition = template.visibleWhen
        var out: [RenderNode] = []
        out.reserveCapacity(min(items.count, limit))

        for (index, item) in items.enumerated() {
            if index >= limit { break }
            let itemScope = scope.withLocals([
                repeatSpec.asName: item,
                repeatSpec.indexName: .number(Double(index)),
            ])

            // visibleWhen は要素ごとに評価する (item を参照できる必要があるため)。
            if let condition, !evaluate(condition, itemScope, &ctx).isTruthy { continue }

            let key = repeatSpec.key.map { evaluate($0, itemScope, &ctx).stringify() }
            guard supportedComponents.contains(template.type) else {
                out.append(contentsOf: degrade(template, itemScope, &ctx, key: key))
                continue
            }
            out.append(resolveSupported(template, itemScope, &ctx, key: key, index: index))
        }
        return out
    }

    // MARK: - 値の解決

    private func resolveValues(
        _ source: [String: SpValue],
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> [String: SpValue] {
        guard !source.isEmpty else { return [:] }
        var out: [String: SpValue] = [:]
        out.reserveCapacity(source.count)
        for (key, value) in source { out[key] = resolveValue(value, scope, &ctx) }
        return out
    }

    private func resolveValue(
        _ value: SpValue,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> SpValue {
        switch value {
        case .string(let text):
            let result = templates.evaluate(text, scope: scope)
            ctx.errors.append(contentsOf: result.errors.map { "\($0.code.rawValue): \($0.message)" })
            return result.value
        case .array(let items):
            return .array(items.map { resolveValue($0, scope, &ctx) })
        case .object(let entries):
            return .object(entries.mapValues { resolveValue($0, scope, &ctx) })
        default:
            return value
        }
    }

    private func evaluate(
        _ source: String,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> SpValue {
        let result = templates.evaluate(source, scope: scope)
        ctx.errors.append(contentsOf: result.errors.map { "\($0.code.rawValue): \($0.message)" })
        return result.value
    }
}
