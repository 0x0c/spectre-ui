package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import dev.spectre.core.expr.TemplateEvaluator

/**
 * 未解決のドキュメント + 状態 -> 描画用の [RenderNode] 木。
 *
 * ここで以下をすべて済ませるため、レンダラは分岐も式評価も持たずに済む。
 * - 式とテンプレートの解決
 * - `visibleWhen` による木からの除外
 * - `repeat` の展開
 * - 未対応コンポーネントの劣化 (fallback / 省略)
 *
 * レンダラが未知の型を目にすることはない (docs/architecture.md §2)。
 */
class Resolver(
    private val templates: TemplateEvaluator = TemplateEvaluator(),
    /**
     * このクライアントが解釈できるコンポーネント名。
     * ホストアプリが一部を無効化できるよう、カタログ全体とは別に受け取る。
     */
    private val supportedComponents: Set<String> = GeneratedCatalog.componentNames,
) {

    fun resolve(document: Document, scope: EvalScope): ResolveResult {
        val ctx = Context()
        val roots = resolveNode(document.root, scope, ctx)
        val overlays = document.overlays.map { resolveOverlay(it, scope, ctx) }
        return ResolveResult(
            root = roots.firstOrNull(),
            overlays = overlays,
            degradations = ctx.degradations,
            exprErrors = ctx.errors,
        )
    }

    /** ノード単体を解決する。テストとオーバレイの解決から使う。 */
    fun resolveNodes(node: Node, scope: EvalScope): ResolveResult {
        val ctx = Context()
        val roots = resolveNode(node, scope, ctx)
        return ResolveResult(roots.firstOrNull(), emptyList(), ctx.degradations, ctx.errors)
    }

    private class Context {
        val degradations = ArrayList<Degradation>()
        val errors = ArrayList<String>()
    }

    private fun resolveOverlay(overlay: Overlay, scope: EvalScope, ctx: Context): RenderOverlay =
        RenderOverlay(
            id = overlay.id,
            kind = overlay.kind,
            props = resolveValues(overlay.props, scope, ctx),
            root = overlay.root?.let { resolveNode(it, scope, ctx).firstOrNull() },
            buttons = overlay.buttons.map {
                RenderOverlayButton(
                    label = evaluateToString(it.label, scope, ctx),
                    role = it.role,
                    actions = it.actions,
                )
            },
        )

    /**
     * 1つの [Node] は 0個以上の [RenderNode] になる。
     * - `visibleWhen` が偽 / 未対応で省略 -> 0個
     * - `repeat` -> 要素数ぶん
     */
    private fun resolveNode(node: Node, scope: EvalScope, ctx: Context): List<RenderNode> {
        // 1. repeat は最初に展開する。visibleWhen は展開後の各要素に対して評価される。
        val repeat = node.repeat
        if (repeat != null) {
            return expandRepeat(node, repeat, scope, ctx)
        }

        // 2. 可視性。除外されたノードは劣化の集計対象にもしない。
        node.visibleWhen?.let { condition ->
            if (!evaluateToBoolean(condition, scope, ctx)) return emptyList()
        }

        // 3. ケイパビリティによる劣化
        if (!supportedComponents.contains(node.type)) {
            return degrade(node, scope, ctx)
        }

        // 4. 実際の解決
        return listOf(resolveSupportedNode(node, scope, ctx, key = null))
    }

    private fun resolveSupportedNode(
        node: Node,
        scope: EvalScope,
        ctx: Context,
        key: String?,
    ): RenderNode = RenderNode(
        type = node.type,
        id = node.id,
        key = key,
        props = resolveValues(node.props, scope, ctx),
        // アクションは解決しない。タップ時点の state を見る必要があるため、
        // 式は文字列のまま保持してディスパッチ時に評価する。
        rawProps = node.rawProps,
        nodeProps = node.nodeProps.mapValues { (_, nodes) ->
            nodes.flatMap { resolveNode(it, scope, ctx) }
        }.filterValues { it.isNotEmpty() },
        children = node.children.flatMap { resolveNode(it, scope, ctx) },
        layout = resolveValues(node.layout, scope, ctx),
        style = resolveValues(node.style, scope, ctx),
        a11y = resolveValues(node.a11y, scope, ctx),
    )

    /**
     * 未対応コンポーネントの劣化 (docs/compatibility.md §3, ADR-0006)。
     *
     * fallback -> optional による省略 -> プレースホルダ の順に落ちる。
     * どの経路でもクラッシュしないことが不変条件。
     *
     * [key] は `repeat` 展開中の要素だけが持つ安定キー ([expandRepeat] 経由)。
     * fallback やプレースホルダに落ちても要素の同一性が保てるよう引き継ぐ。
     */
    private fun degrade(node: Node, scope: EvalScope, ctx: Context, key: String? = null): List<RenderNode> {
        val fallback = node.fallback
        if (fallback != null) {
            ctx.degradations.add(Degradation(node.type, node.id, DegradedTo.FALLBACK))
            // fallback 自体が未対応なら、その fallback へと再帰的に落ちていく。
            val resolved = resolveNode(fallback, scope, ctx)
            // fallback がちょうど1ノードに解決された場合だけキーを引き継ぐ — fallback 自身が
            // repeat や visibleWhen を持ち0件/複数件になるケースは単一の安定キーを持てない。
            return if (key != null && resolved.size == 1) listOf(resolved[0].copy(key = key)) else resolved
        }
        if (node.optional) {
            ctx.degradations.add(Degradation(node.type, node.id, DegradedTo.OMITTED, intentional = true))
            return emptyList()
        }
        // 必須 (optional でない) かつ fallback もない — 黙って省略すると
        // 「何かが表示されないまま失われた」ことが誰にも見えなくなる。最終手段として
        // 汎用プレースホルダに置き換える。layout/style/a11y は型に依存しない共通の
        // フィールドなので、未知の型でも解決して引き継げる (レイアウトの穴を防ぐ)。
        ctx.degradations.add(Degradation(node.type, node.id, DegradedTo.PLACEHOLDER))
        return listOf(
            RenderNode(
                type = PLACEHOLDER_NODE_TYPE,
                id = node.id,
                key = key,
                props = mapOf("componentType" to SpValue.Str(node.type)),
                layout = resolveValues(node.layout, scope, ctx),
                style = resolveValues(node.style, scope, ctx),
                a11y = resolveValues(node.a11y, scope, ctx),
            )
        )
    }

    private fun expandRepeat(
        node: Node,
        repeat: RepeatSpec,
        scope: EvalScope,
        ctx: Context,
    ): List<RenderNode> {
        val source = evaluate(repeat.forExpression, scope, ctx)
        val items = (source as? SpValue.Arr)?.items

        if (items.isNullOrEmpty()) {
            // 配列でない場合も 0 件として扱う。式が壊れていても画面は壊れない。
            val emptyView = repeat.emptyView ?: return emptyList()
            return resolveNode(emptyView, scope, ctx)
        }

        val limit = minOf(repeat.limit ?: SpectreLimits.MAX_REPEAT_ITEMS, SpectreLimits.MAX_REPEAT_ITEMS)
        if (items.size > limit) {
            ctx.errors.add("repeat の件数 ${items.size} が上限 $limit を超えたため切り詰めました")
        }

        val out = ArrayList<RenderNode>(minOf(items.size, limit))
        // repeat を取り除いたノードを各要素のスコープで解決する。
        val template = node.copy(repeat = null)
        val condition = template.visibleWhen

        for ((index, item) in items.withIndex()) {
            if (index >= limit) break
            val itemScope = scope.withLocals(
                mapOf(
                    repeat.asName to item,
                    repeat.indexName to SpValue.Num(index.toDouble()),
                )
            )

            // visibleWhen は要素ごとに評価する (item を参照できる必要があるため)。
            if (condition != null && !evaluateToBoolean(condition, itemScope, ctx)) continue

            val key = repeat.key?.let { evaluateToString(it, itemScope, ctx) }
            if (!supportedComponents.contains(template.type)) {
                out.addAll(degrade(template, itemScope, ctx, key))
                continue
            }
            out.add(resolveSupportedNode(template, itemScope, ctx, key))
        }
        return out
    }

    // -- 値の解決 -------------------------------------------------------------

    private fun resolveValues(
        source: Map<String, SpValue>,
        scope: EvalScope,
        ctx: Context,
    ): Map<String, SpValue> {
        if (source.isEmpty()) return emptyMap()
        val out = LinkedHashMap<String, SpValue>(source.size)
        for ((key, value) in source) out[key] = resolveValue(value, scope, ctx)
        return out
    }

    private fun resolveValue(value: SpValue, scope: EvalScope, ctx: Context): SpValue = when (value) {
        is SpValue.Str -> {
            val result = templates.evaluate(value.value, scope)
            result.errors.forEach { ctx.errors.add("${it.code}: ${it.message}") }
            result.value
        }
        is SpValue.Arr -> SpValue.Arr(value.items.map { resolveValue(it, scope, ctx) })
        is SpValue.Obj -> SpValue.Obj(value.entries.mapValues { resolveValue(it.value, scope, ctx) })
        else -> value
    }

    private fun evaluate(source: String, scope: EvalScope, ctx: Context): SpValue {
        val result = templates.evaluate(source, scope)
        result.errors.forEach { ctx.errors.add("${it.code}: ${it.message}") }
        return result.value
    }

    private fun evaluateToBoolean(source: String, scope: EvalScope, ctx: Context): Boolean =
        evaluate(source, scope, ctx).isTruthy

    private fun evaluateToString(source: String, scope: EvalScope, ctx: Context): String =
        evaluate(source, scope, ctx).stringify()
}
