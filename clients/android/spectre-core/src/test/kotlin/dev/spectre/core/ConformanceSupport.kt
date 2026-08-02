package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import kotlinx.serialization.json.Json
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * 適合性コーパス (spec/conformance) を読むための共通処理。
 *
 * このコーパスは Swift / Kotlin / TypeScript の3実装が同じ入力に対して
 * 同じ結果を返すことを機械的に保証するためのもの。実装非依存の JSON なので、
 * 各クライアント SDK のテストがこのファイル群を直接読んで実行する
 * (docs/tech-selection.md ADR-0008)。
 */
object Conformance {

    private val json = Json { ignoreUnknownKeys = true }

    val corpusDir: File by lazy {
        val configured = System.getProperty("spectre.conformance.dir")
        val candidates = listOfNotNull(
            configured?.let(::File),
            File("../../../spec/conformance"),
            File("spec/conformance"),
        )
        candidates.firstOrNull { it.isDirectory }
            ?: fail(
                "適合性コーパスが見つかりません。試したパス: " +
                    candidates.joinToString { it.absolutePath }
            )
    }

    val examplesDir: File by lazy {
        val configured = System.getProperty("spectre.examples.dir")
        val candidates = listOfNotNull(
            configured?.let(::File),
            File("../../../examples"),
            File("examples"),
        )
        candidates.firstOrNull { it.isDirectory }
            ?: fail("examples が見つかりません")
    }

    fun loadDir(name: String): List<Pair<String, SpValue.Obj>> {
        val dir = File(corpusDir, name)
        check(dir.isDirectory) { "${dir.absolutePath} がありません" }
        return dir.listFiles { f -> f.extension == "json" }
            .orEmpty()
            .sortedBy { it.name }
            .map { file -> file.name to parseObject(file.readText()) }
    }

    fun parseObject(text: String): SpValue.Obj =
        json.parseToJsonElement(text).toSpValue() as SpValue.Obj

    /**
     * 数値は微小な誤差を許容して比較する。
     *
     * `round(1.2345, 2)` のような計算は 10 のべき乗を経由するため、
     * プラットフォームによって最下位ビットがずれうる。仕様として意味があるのは
     * その桁までではないので、ここで吸収する。
     */
    fun valuesEqual(a: SpValue, b: SpValue): Boolean = when {
        a is SpValue.Num && b is SpValue.Num ->
            a.value == b.value || Math.abs(a.value - b.value) < 1e-9
        a is SpValue.Arr && b is SpValue.Arr ->
            a.items.size == b.items.size && a.items.indices.all { valuesEqual(a.items[it], b.items[it]) }
        a is SpValue.Obj && b is SpValue.Obj ->
            a.entries.keys == b.entries.keys && a.entries.all { (k, v) -> valuesEqual(v, b.entries.getValue(k)) }
        else -> a == b
    }

    /** 失敗メッセージ用の可読な表現。 */
    fun describe(value: SpValue): String = when (value) {
        is SpValue.Str -> "\"${value.value}\""
        is SpValue.Null -> "null"
        else -> value.stringify()
    }

    /**
     * 「document + capabilities -> 正規化された RenderTree + degradations」のケースを1件実行する。
     *
     * `resolve/resolver.json` (基本の解決規則) と `compat/` (ケイパビリティ由来の劣化) の
     * 両方が同じ形のケースを使うため、[ConformanceResolveTest] と [ConformanceCompatTest] で共有する。
     */
    fun runResolveCase(case: SpValue.Obj) {
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
            val actual = result.root?.let { normalizeRenderNode(it) } ?: SpValue.Null
            assertTrue(
                valuesEqual(actual, expected),
                "解決結果が期待と異なります\n" +
                    "  期待: ${expected.stringify()}\n" +
                    "  実際: ${actual.stringify()}",
            )
        }

        (case.entries["expectOverlays"] as? SpValue.Arr)?.items?.let { expected ->
            val actual = result.overlays.map { normalizeRenderOverlay(it) }
            assertEquals(
                expected.size,
                actual.size,
                "オーバレイの件数が異なります\n  期待: ${SpValue.Arr(expected).stringify()}\n" +
                    "  実際: ${SpValue.Arr(actual).stringify()}",
            )
            expected.forEachIndexed { i, exp ->
                assertTrue(
                    valuesEqual(actual[i], exp),
                    "オーバレイ[$i] が期待と異なります\n  期待: ${exp.stringify()}\n  実際: ${actual[i].stringify()}",
                )
            }
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
                    valuesEqual(actual[i], exp),
                    "劣化[$i] が期待と異なります\n  期待: ${exp.stringify()}\n  実際: ${actual[i].stringify()}",
                )
            }
        }
    }

    /**
     * [RenderOverlay] をコーパスの期待値と同じ形に正規化する。
     *
     * `presentation` のような見え方のオプション (SU-0014) は `props` にそのまま入る。
     * 解決を経ても形が変わらないこと、書かれていないキーが既定値で補われないことを、
     * ここを通してコーパスから確かめられる。
     */
    fun normalizeRenderOverlay(overlay: RenderOverlay): SpValue.Obj {
        val out = LinkedHashMap<String, SpValue>()
        out["id"] = SpValue.Str(overlay.id)
        out["kind"] = SpValue.Str(overlay.kind.name.lowercase())
        if (overlay.props.isNotEmpty()) out["props"] = SpValue.Obj(LinkedHashMap(overlay.props))
        overlay.root?.let { out["root"] = normalizeRenderNode(it) }
        if (overlay.buttons.isNotEmpty()) {
            out["buttons"] = SpValue.Arr(
                overlay.buttons.map {
                    SpValue.Obj(linkedMapOf("label" to SpValue.Str(it.label), "role" to SpValue.Str(it.role)))
                }
            )
        }
        return SpValue.Obj(out)
    }

    /**
     * [RenderNode] をコーパスの期待値と同じ形に正規化する。
     *
     * 空のフィールドは出力しない。既定値の適用は描画時であって解決時ではないため、
     * ソースに現れなかったプロパティはここにも現れない。プレースホルダ
     * ([PLACEHOLDER_NODE_TYPE]) はマニフェストに存在しないため `acceptsChildren` は常に
     * false 扱いになり、`children` を出力しない (葉ノードと同じ扱いでよい)。
     */
    fun normalizeRenderNode(node: RenderNode): SpValue.Obj {
        val out = LinkedHashMap<String, SpValue>()
        out["type"] = SpValue.Str(node.type)
        node.id?.let { out["id"] = SpValue.Str(it) }
        node.key?.let { out["key"] = SpValue.Str(it) }

        val props = LinkedHashMap<String, SpValue>()
        props.putAll(node.props)
        props.putAll(node.rawProps)
        node.nodeProps.forEach { (path, nodes) ->
            props[path] = SpValue.Arr(nodes.map { normalizeRenderNode(it) })
        }
        if (props.isNotEmpty()) out["props"] = SpValue.Obj(props)

        if (node.layout.isNotEmpty()) out["layout"] = SpValue.Obj(node.layout)
        if (node.style.isNotEmpty()) out["style"] = SpValue.Obj(node.style)
        if (node.a11y.isNotEmpty()) out["a11y"] = SpValue.Obj(node.a11y)

        // 子を取れるコンポーネントは、0件でも children を出力する。
        // 「repeat が何も生まなかったコンテナ」と「そもそも子を持たない葉」は別物なので、
        // 期待値の側でも区別できるようにしておく。
        if (GeneratedCatalog.spec(node.type)?.acceptsChildren == true) {
            out["children"] = SpValue.Arr(node.children.map { normalizeRenderNode(it) })
        }
        return SpValue.Obj(out)
    }
}
