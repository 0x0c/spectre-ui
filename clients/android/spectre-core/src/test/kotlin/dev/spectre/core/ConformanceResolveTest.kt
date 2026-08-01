package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import org.junit.jupiter.api.DynamicNode
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * spec/conformance/resolve/resolver.json の全ケースを実行する。
 *
 * 検証対象は「未解決ドキュメント + 状態 -> 正規化された描画木」の写像。
 * レイアウト計算の前段までなので、プラットフォーム間で完全一致を要求できる。
 */
class ConformanceResolveTest {

    @TestFactory
    fun resolverCorpus(): List<DynamicNode> {
        val doc = Conformance.loadDir("resolve").first { it.first == "resolver.json" }.second
        val cases = (doc.entries["cases"] as? SpValue.Arr)?.items.orEmpty()

        return cases.mapIndexedNotNull { index, raw ->
            val case = raw as? SpValue.Obj ?: return@mapIndexedNotNull null
            val name = case.entries["name"]?.asStringOrNull ?: "case $index"
            DynamicTest.dynamicTest(name) { runCase(case) }
        }
    }

    private fun runCase(case: SpValue.Obj) {
        val documentValue = case.entries["document"] as? SpValue.Obj
            ?: error("document がありません")
        val document = DocumentParser.parse(documentValue)

        // ケイパビリティ指定がなければカタログ全体を対応済みとみなす。
        val supported = (case.entries["capabilities"] as? SpValue.Obj)
            ?.entries?.get("components")
            ?.asListOrNull
            ?.mapNotNull { it.asStringOrNull }
            ?.toSet()
            ?: GeneratedCatalog.componentNames

        val scope = EvalScope(
            data = document.data,
            state = document.state,
            env = (case.entries["env"] as? SpValue.Obj) ?: SpValue.EmptyObj,
        )

        val result = Resolver(supportedComponents = supported).resolve(document, scope)

        case.entries["expect"]?.let { expected ->
            val actual = result.root?.let { normalize(it) } ?: SpValue.Null
            assertTrue(
                Conformance.valuesEqual(actual, expected),
                "解決結果が期待と異なります\n" +
                    "  期待: ${expected.stringify()}\n" +
                    "  実際: ${actual.stringify()}",
            )
        }

        (case.entries["expectDegradations"] as? SpValue.Arr)?.items?.let { expected ->
            val actual = result.degradations.map {
                SpValue.Obj(
                    linkedMapOf(
                        "nodeType" to SpValue.Str(it.nodeType),
                        "degradedTo" to SpValue.Str(it.degradedTo.wireName),
                    )
                )
            }
            assertEquals(
                expected.size,
                actual.size,
                "劣化の件数が異なります\n  期待: ${SpValue.Arr(expected).stringify()}\n" +
                    "  実際: ${SpValue.Arr(actual).stringify()}",
            )
            expected.forEachIndexed { i, exp ->
                assertTrue(
                    Conformance.valuesEqual(actual[i], exp),
                    "劣化[$i] が期待と異なります\n  期待: ${exp.stringify()}\n  実際: ${actual[i].stringify()}",
                )
            }
        }
    }

    /**
     * [RenderNode] をコーパスの期待値と同じ形に正規化する。
     *
     * 空のフィールドは出力しない。既定値の適用は描画時であって解決時ではないため、
     * ソースに現れなかったプロパティはここにも現れない。
     */
    private fun normalize(node: RenderNode): SpValue.Obj {
        val out = LinkedHashMap<String, SpValue>()
        out["type"] = SpValue.Str(node.type)
        node.id?.let { out["id"] = SpValue.Str(it) }
        node.key?.let { out["key"] = SpValue.Str(it) }

        val props = LinkedHashMap<String, SpValue>()
        props.putAll(node.props)
        props.putAll(node.rawProps)
        node.nodeProps.forEach { (path, nodes) ->
            props[path] = SpValue.Arr(nodes.map { normalize(it) })
        }
        if (props.isNotEmpty()) out["props"] = SpValue.Obj(props)

        if (node.layout.isNotEmpty()) out["layout"] = SpValue.Obj(node.layout)
        if (node.style.isNotEmpty()) out["style"] = SpValue.Obj(node.style)
        if (node.a11y.isNotEmpty()) out["a11y"] = SpValue.Obj(node.a11y)

        // 子を取れるコンポーネントは、0件でも children を出力する。
        // 「repeat が何も生まなかったコンテナ」と「そもそも子を持たない葉」は別物なので、
        // 期待値の側でも区別できるようにしておく。
        if (GeneratedCatalog.spec(node.type)?.acceptsChildren == true) {
            out["children"] = SpValue.Arr(node.children.map { normalize(it) })
        }
        return SpValue.Obj(out)
    }
}
