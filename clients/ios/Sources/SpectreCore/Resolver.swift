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

    /// `node` 以下が静的に参照しうるスコープ相対パスの和集合のメモ。`Node` は
    /// クラス (参照型) なのでオブジェクト識別子でそのまま記憶できる — `repeat` の
    /// 展開で使い回される同一の `template` ノードや、たまたま同じ内容の兄弟ノードを
    /// 取り違えることがない。
    private var depsCache: [ObjectIdentifier: Set<String>] = [:]

    public init(
        templates: TemplateEvaluator = TemplateEvaluator(),
        supportedComponents: Set<String> = GeneratedCatalog.componentNames
    ) {
        self.templates = templates
        self.supportedComponents = supportedComponents
    }

    public func resolve(_ document: Document, scope: EvalScope) -> ResolveResult {
        resolveTraced(document, scope: scope).result
    }

    /// ドキュメント全体を初回解決する。以後の `reresolveTraced` が参照するノード単位の
    /// 解決結果 (`TracedResolveResult.nodeResults`) も同時に記録する。
    public func resolveTraced(_ document: Document, scope: EvalScope) -> TracedResolveResult {
        depsCache.removeAll() // 新しいドキュメント木なので、前のドキュメントの記憶は捨てる。
        var output: [ObjectIdentifier: [RenderNode]] = [:]
        var ctx = Context(diff: DiffContext(changed: nil, previous: [:], output: output))
        let roots = resolveNode(document.root, scope, &ctx)
        let overlays = document.overlays.map { resolveOverlay($0, scope, &ctx) }
        output = ctx.diff?.output ?? [:]
        let result = ResolveResult(
            root: roots.first, overlays: overlays, degradations: ctx.degradations, exprErrors: ctx.errors
        )
        return TracedResolveResult(result: result, nodeResults: output)
    }

    /// `changedPaths` に影響されないノードは前回の `RenderNode` をそのまま再利用し、
    /// 影響されうる部分だけを再解決する (docs/architecture.md §2, §5)。
    ///
    /// `repeat` は要素単位では追跡しない — 展開後の各要素は同一の `template` ノード
    /// インスタンスを共有しており個別の識別子を持てないため、`repeat` ノードは
    /// 「丸ごと再利用」か「丸ごと再展開」のどちらかになる。それでも、影響を受けていない
    /// 兄弟の部分木を再帰せずに済むため、ドキュメント全体を再解決するより十分に軽い。
    public func reresolveTraced(
        _ document: Document,
        previous: TracedResolveResult,
        changedPaths: Set<String>,
        scope: EvalScope
    ) -> TracedResolveResult {
        guard !changedPaths.isEmpty else { return previous }
        var ctx = Context(diff: DiffContext(changed: changedPaths, previous: previous.nodeResults, output: [:]))
        let roots = resolveNode(document.root, scope, &ctx)
        let overlays = document.overlays.map { resolveOverlay($0, scope, &ctx) }
        let output = ctx.diff?.output ?? [:]
        let result = ResolveResult(
            root: roots.first, overlays: overlays, degradations: ctx.degradations, exprErrors: ctx.errors
        )
        return TracedResolveResult(result: result, nodeResults: output)
    }

    /// `node` 以下が参照しうる `data.*` / `state.*` パスの和集合。メモ化して繰り返し計算しない。
    private func aggregateDependencies(_ node: Node) -> Set<String> {
        let key = ObjectIdentifier(node)
        if let cached = depsCache[key] { return cached }
        var out = Set<String>()
        if let visibleWhen = node.visibleWhen { out.formUnion(templates.dependencies(visibleWhen)) }
        if let repeatSpec = node.repeatSpec { out.formUnion(templates.dependencies(repeatSpec.forExpression)) }
        for value in node.props.values { collectValueDependencies(value, &out) }
        for value in node.layout.values { collectValueDependencies(value, &out) }
        for value in node.style.values { collectValueDependencies(value, &out) }
        for value in node.a11y.values { collectValueDependencies(value, &out) }
        // rawProps (アクション式) は意図的に含めない — アクション実行時点の state を
        // その都度読むため、値そのものの再解決には関与しない。
        for children in node.nodeProps.values {
            for child in children { out.formUnion(aggregateDependencies(child)) }
        }
        for child in node.children { out.formUnion(aggregateDependencies(child)) }
        if let emptyView = node.repeatSpec?.emptyView { out.formUnion(aggregateDependencies(emptyView)) }
        if let fallback = node.fallback { out.formUnion(aggregateDependencies(fallback)) }
        depsCache[key] = out
        return out
    }

    private func collectValueDependencies(_ value: SpValue, _ out: inout Set<String>) {
        switch value {
        case .string(let text):
            out.formUnion(templates.dependencies(text))
        case .array(let items):
            for item in items { collectValueDependencies(item, &out) }
        case .object(let entries):
            for entry in entries.values { collectValueDependencies(entry, &out) }
        default:
            break
        }
    }

    /// `changed` のいずれかのパスが `deps` のいずれかと重なる (祖先/子孫を含む) か。
    private func intersects(_ deps: Set<String>, _ changed: Set<String>) -> Bool {
        deps.contains { d in
            changed.contains { c in d == c || d.hasPrefix("\(c).") || c.hasPrefix("\(d).") }
        }
    }

    /// 差分解決の文脈。`changed` が nil なら「初回解決 (常に再計算し、結果を記録するだけ)」、
    /// 非 nil なら「差分解決 (未変化ならば再利用を試みる)」を表す。
    private struct DiffContext {
        let changed: Set<String>?
        let previous: [ObjectIdentifier: [RenderNode]]
        var output: [ObjectIdentifier: [RenderNode]]
    }

    private struct Context {
        var diff: DiffContext?
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
    ///
    /// `ctx.diff` が差分解決中であれば、`node` 以下が `changed` のどれにも依存しないと
    /// 分かった時点で、前回の結果をそのまま返して再帰を打ち切る。
    private func resolveNode(
        _ node: Node,
        _ scope: EvalScope,
        _ ctx: inout Context
    ) -> [RenderNode] {
        let key = ObjectIdentifier(node)
        if let changed = ctx.diff?.changed, let reused = ctx.diff?.previous[key],
           !intersects(aggregateDependencies(node), changed) {
            ctx.diff!.output[key] = reused
            return reused
        }

        // 1. repeat は最初に展開する。visibleWhen は展開後の各要素に対して評価される。
        let result: [RenderNode]
        if let repeatSpec = node.repeatSpec {
            result = expandRepeat(node, repeatSpec, scope, &ctx)
        } else if let condition = node.visibleWhen, !evaluate(condition, scope, &ctx).isTruthy {
            // 2. 可視性。除外されたノードは劣化の集計対象にもしない。
            result = []
        } else if !supportedComponents.contains(node.type) {
            // 3. ケイパビリティによる劣化
            result = degrade(node, scope, &ctx)
        } else {
            // 4. 実際の解決
            result = [resolveSupported(node, scope, &ctx, key: nil, index: nil)]
        }

        if ctx.diff != nil { ctx.diff!.output[key] = result }
        return result
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

    /// `repeat` は要素ごとの識別子を持てないため、常に非差分 (`outerCtx.diff` を
    /// 引き継がない) 経路で展開する。展開そのものを行うかどうかの判断
    /// (再利用できるか) は呼び出し元の `resolveNode` がノード全体の依存で行う。
    private func expandRepeat(
        _ node: Node,
        _ repeatSpec: RepeatSpec,
        _ scope: EvalScope,
        _ outerCtx: inout Context
    ) -> [RenderNode] {
        var ctx = Context(diff: nil)
        let source = evaluate(repeatSpec.forExpression, scope, &ctx)
        let result: [RenderNode]
        if let items = source.asArray, !items.isEmpty {
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

                // key はここで一度だけ評価する — fallback やプレースホルダに落ちても
                // 同じ安定キーを引き継げるように、劣化判定より先に計算しておく。
                let key = repeatSpec.key.map { evaluate($0, itemScope, &ctx).stringify() }
                guard supportedComponents.contains(template.type) else {
                    out.append(contentsOf: degrade(template, itemScope, &ctx, key: key))
                    continue
                }
                out.append(resolveSupported(template, itemScope, &ctx, key: key, index: index))
            }
            result = out
        } else {
            // 配列でない場合も 0 件として扱う。式が壊れていても画面は壊れない。
            if let emptyView = repeatSpec.emptyView {
                result = resolveNode(emptyView, scope, &ctx)
            } else {
                result = []
            }
        }

        outerCtx.degradations.append(contentsOf: ctx.degradations)
        outerCtx.errors.append(contentsOf: ctx.errors)
        return result
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
