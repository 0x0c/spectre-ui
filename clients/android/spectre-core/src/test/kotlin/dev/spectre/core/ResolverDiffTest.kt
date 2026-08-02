package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import org.junit.jupiter.api.DisplayName
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotSame
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

/**
 * [Resolver.reresolveTraced] が、変更された state/data のパスに依存しないノードを
 * 再解決せずに前回の [RenderNode] を再利用することを確認する。
 *
 * docs/architecture.md §2, §5 が要求する差分再解決の受け入れ条件: 全解決と同じ結果を
 * 返しつつ、影響のない部分木は同一インスタンスを返す (再計算していないことの証拠)。
 */
class ResolverDiffTest {

    private val documentText = """
        {
          "schemaVersion": "1.0",
          "id": "diff_test",
          "data": {"items": [{"name": "a"}, {"name": "b"}]},
          "state": {"counterA": 1, "counterB": 10, "showC": true, "filter": "x"},
          "root": {
            "type": "Screen",
            "children": [
              {"type": "Text", "id": "a", "props": {"text": "${'$'}{state.counterA}"}},
              {"type": "Text", "id": "b", "props": {"text": "${'$'}{state.counterB}"}},
              {"type": "Text", "id": "c", "props": {"text": "shown"}, "visibleWhen": "${'$'}{state.showC}"},
              {
                "type": "Text",
                "id": "item",
                "props": {"text": "${'$'}{item.name}-${'$'}{state.filter}"},
                "repeat": {"for": "${'$'}{data.items}"}
              }
            ]
          }
        }
    """.trimIndent()

    private fun load(): Document = DocumentParser.parse(documentText)

    private fun collect(node: RenderNode): List<RenderNode> =
        listOf(node) + node.children.flatMap { collect(it) }

    @Test
    @DisplayName("変更されたパスに依存しない兄弟ノードは同一インスタンスを再利用する")
    fun reusesUnaffectedSiblingInstance() {
        val document = load()
        val resolver = Resolver()
        val store = Store(initialData = document.data, initialState = document.state)

        val initial = resolver.resolveTraced(document, store.scope())
        val nodeA = collect(requireNotNull(initial.result.root)).first { it.id == "a" }
        val nodeC = collect(requireNotNull(initial.result.root)).first { it.id == "c" }
        val nodeItems = collect(requireNotNull(initial.result.root)).filter { it.id == "item" }

        store.setState("counterB", SpValue.Num(11.0))
        val changed = store.consumeChangedPaths()
        assertEquals(setOf("state.counterB"), changed)

        val next = resolver.reresolveTraced(document, initial, changed, store.scope())
        val nextRoot = requireNotNull(next.result.root)
        val nextNodeA = collect(nextRoot).first { it.id == "a" }
        val nextNodeB = collect(nextRoot).first { it.id == "b" }
        val nextNodeC = collect(nextRoot).first { it.id == "c" }
        val nextNodeItems = collect(nextRoot).filter { it.id == "item" }

        // 変更されていない兄弟は同一インスタンス (再計算していない証拠)。
        assertSame(nodeA, nextNodeA)
        assertSame(nodeC, nextNodeC)
        assertEquals(nodeItems, nextNodeItems)
        nodeItems.zip(nextNodeItems).forEach { (a, b) -> assertSame(a, b) }

        // 変更された state を参照するノードは新しい値になる。
        assertEquals("11", nextNodeB.prop("text").stringify())
    }

    @Test
    @DisplayName("visibleWhen が依存するパスが変わると可視性が更新される")
    fun updatesVisibilityWhenItsOwnDependencyChanges() {
        val document = load()
        val resolver = Resolver()
        val store = Store(initialData = document.data, initialState = document.state)

        val initial = resolver.resolveTraced(document, store.scope())
        assertTrue(collect(requireNotNull(initial.result.root)).any { it.id == "c" })

        store.setState("showC", SpValue.Bool(false))
        val changed = store.consumeChangedPaths()
        val next = resolver.reresolveTraced(document, initial, changed, store.scope())

        assertNull(collect(requireNotNull(next.result.root)).find { it.id == "c" })
    }

    @Test
    @DisplayName("repeat は自身と無関係な変更では丸ごと再利用される")
    fun reusesRepeatWholesaleWhenUnaffected() {
        val document = load()
        val resolver = Resolver()
        val store = Store(initialData = document.data, initialState = document.state)

        val initial = resolver.resolveTraced(document, store.scope())
        val items = collect(requireNotNull(initial.result.root)).filter { it.id == "item" }

        store.setState("counterA", SpValue.Num(2.0))
        val changed = store.consumeChangedPaths()
        val next = resolver.reresolveTraced(document, initial, changed, store.scope())
        val nextItems = collect(requireNotNull(next.result.root)).filter { it.id == "item" }

        items.zip(nextItems).forEach { (a, b) -> assertSame(a, b) }
    }

    @Test
    @DisplayName("repeat の本体が依存するパスが変わると全要素が再展開される")
    fun reexpandsRepeatWhenBodyDependencyChanges() {
        val document = load()
        val resolver = Resolver()
        val store = Store(initialData = document.data, initialState = document.state)

        val initial = resolver.resolveTraced(document, store.scope())
        val items = collect(requireNotNull(initial.result.root)).filter { it.id == "item" }
        assertEquals(listOf("a-x", "b-x"), items.map { it.prop("text").stringify() })

        store.setState("filter", SpValue.Str("y"))
        val changed = store.consumeChangedPaths()
        val next = resolver.reresolveTraced(document, initial, changed, store.scope())
        val nextItems = collect(requireNotNull(next.result.root)).filter { it.id == "item" }

        assertEquals(listOf("a-y", "b-y"), nextItems.map { it.prop("text").stringify() })
        items.zip(nextItems).forEach { (a, b) -> assertNotSame(a, b) }
    }

    @Test
    @DisplayName("差分再解決の結果は、同じ状態からの全解決と一致する")
    fun diffResolveMatchesFullResolve() {
        val document = load()
        val store = Store(initialData = document.data, initialState = document.state)

        val initial = Resolver().resolveTraced(document, store.scope())
        store.setState("counterA", SpValue.Num(9.0))
        store.setState("showC", SpValue.Bool(false))
        val changed = store.consumeChangedPaths()

        val diffResolver = Resolver()
        // depsCache を初期状態のまま使うため resolveTraced は呼ばない — reresolveTraced が
        // 必要な依存だけを都度計算する。
        val diffed = diffResolver.reresolveTraced(document, initial, changed, store.scope())

        val full = Resolver().resolve(document, store.scope())

        assertEquals(full.exprErrors, diffed.result.exprErrors)
        assertEquals(
            collect(requireNotNull(full.root)).map { it.id to it.prop("text").stringify() },
            collect(requireNotNull(diffed.result.root)).map { it.id to it.prop("text").stringify() },
        )
    }

    @Test
    @DisplayName("変更パスが空なら前回の結果をそのまま返す")
    fun returnsPreviousWhenNothingChanged() {
        val document = load()
        val resolver = Resolver()
        val store = Store(initialData = document.data, initialState = document.state)
        val initial = resolver.resolveTraced(document, store.scope())

        val next = resolver.reresolveTraced(document, initial, emptySet(), store.scope())

        assertSame(initial, next)
    }
}
