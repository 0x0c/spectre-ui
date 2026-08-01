package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import dev.spectre.core.expr.TemplateEvaluator
import java.util.IdentityHashMap

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

    /**
     * [node] 以下が静的に参照しうるスコープ相対パスの和集合。[Node] インスタンスは
     * ドキュメントの生存期間中は同一参照であり続けるため、参照 ID をキーに記憶できる
     * ([IdentityHashMap] — `data class` の構造的等価性で拾うと、`repeat` の展開で
     * 使い回される同一の `template` ノードや、たまたま同じ内容の兄弟ノードを取り違える)。
     */
    private val depsCache = IdentityHashMap<Node, Set<String>>()

    fun resolve(document: Document, scope: EvalScope): ResolveResult = resolveTraced(document, scope).result

    /** ノード単体を解決する。テストとオーバレイの解決から使う。差分再解決は関与しない。 */
    fun resolveNodes(node: Node, scope: EvalScope): ResolveResult {
        val ctx = Context(diff = null)
        val roots = resolveNode(node, scope, ctx)
        return ResolveResult(roots.firstOrNull(), emptyList(), ctx.degradations, ctx.errors)
    }

    /**
     * ドキュメント全体を初回解決する。以後の [reresolveTraced] が参照する
     * ノード単位の解決結果 ([TracedResolveResult.nodeResults]) も同時に記録する。
     */
    fun resolveTraced(document: Document, scope: EvalScope): TracedResolveResult {
        depsCache.clear() // 新しいドキュメント木なので、前のドキュメントの記憶は捨てる。
        val output = IdentityHashMap<Node, List<RenderNode>>()
        val ctx = Context(diff = DiffContext(changed = null, previous = emptyMap(), output = output))
        val roots = resolveNode(document.root, scope, ctx)
        val overlays = document.overlays.map { resolveOverlay(it, scope, ctx) }
        val result = ResolveResult(roots.firstOrNull(), overlays, ctx.degradations, ctx.errors)
        return TracedResolveResult(result, output)
    }

    /**
     * [changedPaths] に影響されないノードは前回の [RenderNode] をそのまま再利用し、
     * 影響されうる部分だけを再解決する (docs/architecture.md §2, §5)。
     *
     * `repeat` は要素単位では追跡しない — 展開後の各要素は同一の `template` ノード
     * インスタンスを共有しており個別の識別子を持てないため、`repeat` ノードは
     * 「丸ごと再利用」か「丸ごと再展開」のどちらかになる。それでも、影響を受けていない
     * 兄弟の部分木を再帰せずに済むため、ドキュメント全体を再解決するより十分に軽い。
     */
    fun reresolveTraced(
        document: Document,
        previous: TracedResolveResult,
        changedPaths: Set<String>,
        scope: EvalScope,
    ): TracedResolveResult {
        if (changedPaths.isEmpty()) return previous
        val output = IdentityHashMap<Node, List<RenderNode>>()
        val ctx = Context(
            diff = DiffContext(changed = changedPaths, previous = previous.nodeResults, output = output),
        )
        val roots = resolveNode(document.root, scope, ctx)
        val overlays = document.overlays.map { resolveOverlay(it, scope, ctx) }
        val result = ResolveResult(roots.firstOrNull(), overlays, ctx.degradations, ctx.errors)
        return TracedResolveResult(result, output)
    }

    /** [node] 以下が参照しうる `data.*` / `state.*` パスの和集合。メモ化して繰り返し計算しない。 */
    private fun aggregateDependencies(node: Node): Set<String> {
        depsCache[node]?.let { return it }
        val out = LinkedHashSet<String>()
        node.visibleWhen?.let { out.addAll(templates.dependencies(it)) }
        node.repeat?.let { out.addAll(templates.dependencies(it.forExpression)) }
        for (value in node.props.values) collectValueDependencies(value, out)
        for (value in node.layout.values) collectValueDependencies(value, out)
        for (value in node.style.values) collectValueDependencies(value, out)
        for (value in node.a11y.values) collectValueDependencies(value, out)
        // rawProps (アクション式) は意図的に含めない — アクション実行時点の state を
        // その都度読むため、値そのものの再解決には関与しない。
        for (children in node.nodeProps.values) for (child in children) out.addAll(aggregateDependencies(child))
        for (child in node.children) out.addAll(aggregateDependencies(child))
        node.repeat?.emptyView?.let { out.addAll(aggregateDependencies(it)) }
        node.fallback?.let { out.addAll(aggregateDependencies(it)) }
        depsCache[node] = out
        return out
    }

    private fun collectValueDependencies(value: SpValue, out: MutableSet<String>) {
        when (value) {
            is SpValue.Str -> out.addAll(templates.dependencies(value.value))
            is SpValue.Arr -> value.items.forEach { collectValueDependencies(it, out) }
            is SpValue.Obj -> value.entries.values.forEach { collectValueDependencies(it, out) }
            else -> Unit
        }
    }

    /** [changed] のいずれかのパスが [deps] のいずれかと重なる (祖先/子孫を含む) か。 */
    private fun intersects(deps: Set<String>, changed: Set<String>): Boolean =
        deps.any { d -> changed.any { c -> d == c || d.startsWith("$c.") || c.startsWith("$d.") } }

    /**
     * 差分解決の文脈。[changed] が null なら「初回解決 (常に再計算し、結果を記録するだけ)」、
     * 非 null なら「差分解決 (未変化ならば再利用を試みる)」を表す。
     */
    private class DiffContext(
        val changed: Set<String>?,
        val previous: Map<Node, List<RenderNode>>,
        val output: MutableMap<Node, List<RenderNode>>,
    )

    private class Context(val diff: DiffContext?) {
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
     *
     * [Context.diff] が差分解決中であれば、[node] 以下が [DiffContext.changed] の
     * どれにも依存しないと分かった時点で、前回の結果をそのまま返して再帰を打ち切る。
     */
    private fun resolveNode(node: Node, scope: EvalScope, ctx: Context): List<RenderNode> {
        val diff = ctx.diff
        if (diff?.changed != null) {
            val reused = diff.previous[node]
            if (reused != null && !intersects(aggregateDependencies(node), diff.changed)) {
                diff.output[node] = reused
                return reused
            }
        }

        // 1. repeat は最初に展開する。visibleWhen は展開後の各要素に対して評価される。
        val repeat = node.repeat
        val result = if (repeat != null) {
            expandRepeat(node, repeat, scope, ctx)
        } else if (node.visibleWhen != null && !evaluateToBoolean(node.visibleWhen, scope, ctx)) {
            // 2. 可視性。除外されたノードは劣化の集計対象にもしない。
            emptyList()
        } else if (!supportedComponents.contains(node.type)) {
            // 3. ケイパビリティによる劣化
            degrade(node, scope, ctx)
        } else {
            // 4. 実際の解決
            listOf(resolveSupportedNode(node, scope, ctx, key = null))
        }

        diff?.output?.put(node, result)
        return result
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
     * 未対応コンポーネントの劣化 (docs/compatibility.md §3)。
     *
     * fallback -> optional による省略 -> 記録つき省略 の順に落ちる。
     * どの経路でもクラッシュしないことが不変条件。
     */
    private fun degrade(node: Node, scope: EvalScope, ctx: Context): List<RenderNode> {
        val fallback = node.fallback
        if (fallback != null) {
            ctx.degradations.add(Degradation(node.type, node.id, DegradedTo.FALLBACK))
            // fallback 自体が未対応なら、その fallback へと再帰的に落ちていく。
            return resolveNode(fallback, scope, ctx)
        }
        ctx.degradations.add(
            Degradation(node.type, node.id, DegradedTo.OMITTED, intentional = node.optional)
        )
        return emptyList()
    }

    /**
     * `repeat` は要素ごとの識別子を持てないため、常に非差分 (`ctx` の `diff` を
     * 引き継がない) 経路で展開する。展開そのものを行うかどうかの判断
     * (再利用できるか) は呼び出し元の [resolveNode] がノード全体の依存で行う。
     */
    private fun expandRepeat(
        node: Node,
        repeat: RepeatSpec,
        scope: EvalScope,
        outerCtx: Context,
    ): List<RenderNode> {
        val ctx = Context(diff = null)
        val source = evaluate(repeat.forExpression, scope, ctx)
        val items = (source as? SpValue.Arr)?.items

        val result = if (items.isNullOrEmpty()) {
            // 配列でない場合も 0 件として扱う。式が壊れていても画面は壊れない。
            val emptyView = repeat.emptyView
            if (emptyView == null) emptyList() else resolveNode(emptyView, scope, ctx)
        } else {
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

                if (!supportedComponents.contains(template.type)) {
                    out.addAll(degrade(template, itemScope, ctx))
                    continue
                }
                val key = repeat.key?.let { evaluateToString(it, itemScope, ctx) }
                out.add(resolveSupportedNode(template, itemScope, ctx, key))
            }
            out
        }

        outerCtx.degradations.addAll(ctx.degradations)
        outerCtx.errors.addAll(ctx.errors)
        return result
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
