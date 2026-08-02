package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import java.io.File
import org.junit.jupiter.api.DisplayName
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * VRT (ビジュアルリグレッションテスト) のフィクスチャを検証する (SU-0013)。
 *
 * このテストが spectre-ui ではなく spectre-core にあるのは、[RendererCoverageTest] と
 * 同じ理由による。読むのは JSON だけなので、Android SDK も Xcode もない環境で走る。
 * 描画そのものは各プラットフォームの VRT 一式が担当し、ここは「何を描くことになって
 * いるか」だけを見る。
 *
 * 狙いは2つ。カタログにコンポーネントを足したのにフィクスチャへ足し忘れると、
 * ゴールデン画像を持たないコンポーネントが黙って増えてしまう。ケース一覧と
 * フィクスチャの対応が崩れると、片方のプラットフォームだけが描く画面が生まれる。
 */
class VrtFixtureCoverageTest {

    private val repoRoot: File get() = Conformance.corpusDir.parentFile.parentFile

    private val vrtDir: File by lazy {
        File(repoRoot, "spec/vrt").also {
            assertTrue(it.isDirectory, "VRT のフィクスチャが見つかりません: ${it.absolutePath}")
        }
    }

    private val cases: List<SpValue.Obj> by lazy {
        val root = Conformance.parseObject(File(vrtDir, "cases.json").readText())
        val items = (root.entries["cases"] as? SpValue.Arr)?.items
            ?: fail("cases.json に cases 配列がありません")
        assertTrue(items.isNotEmpty(), "VRT のケースが1件もありません")
        items.map { it as? SpValue.Obj ?: fail("ケースがオブジェクトではありません: ${it.stringify()}") }
    }

    private fun string(case: SpValue.Obj, key: String): String =
        case.entries[key]?.asStringOrNull ?: fail("ケースに $key がありません: ${case.stringify()}")

    private fun documentOf(case: SpValue.Obj): Document {
        val file = File(repoRoot, string(case, "document"))
        assertTrue(file.isFile, "ケース ${string(case, "id")} の document がありません: ${file.absolutePath}")
        return DocumentParser.parse(file.readText())
    }

    /** ケースが宣言した描画条件を、そのまま式から見える `env` に落とす。 */
    private fun envOf(case: SpValue.Obj): SpValue.Obj {
        val widthDp = (case.entries["widthDp"] as? SpValue.Num)?.value ?: fail("widthDp がありません")
        return SpValue.Obj(
            mapOf(
                "platform" to SpValue.Str("android"),
                "locale" to SpValue.Str(string(case, "locale")),
                "theme" to SpValue.Str(string(case, "theme")),
                "widthClass" to SpValue.Str(
                    when {
                        widthDp < 600 -> "compact"
                        widthDp < 840 -> "regular"
                        else -> "expanded"
                    }
                ),
            )
        )
    }

    private fun collectTypes(node: RenderNode): Set<String> =
        setOf(node.type) +
            node.children.flatMap { collectTypes(it) } +
            node.nodeProps.values.flatten().flatMap { collectTypes(it) }

    /** 全ケースを解決して、実際に描画されることになる型を集める。 */
    private val renderedTypes: Set<String> by lazy {
        cases.flatMap { case ->
            val document = documentOf(case)
            val scope = EvalScope(data = document.data, state = document.state, env = envOf(case))
            val result = Resolver().resolve(document, scope)
            val root = result.root ?: fail("ケース ${string(case, "id")} が何も解決しませんでした")
            collectTypes(root) + result.overlays.flatMap { overlay ->
                overlay.root?.let { collectTypes(it) }.orEmpty()
            }
        }.toSet()
    }

    @Test
    @DisplayName("VRT のフィクスチャがカタログの全コンポーネントを描画する")
    fun fixturesCoverEveryCatalogComponent() {
        val missing = GeneratedCatalog.componentNames - renderedTypes
        assertTrue(
            missing.isEmpty(),
            "VRT のフィクスチャに現れないコンポーネント: ${missing.sorted()}。" +
                " spec/vrt/screens/ のいずれかに追加してください",
        )
    }

    @Test
    @DisplayName("VRT のフィクスチャがカタログにない型を含まない")
    fun fixturesUseOnlyCatalogComponents() {
        val unknown = renderedTypes - GeneratedCatalog.componentNames
        assertTrue(
            unknown.isEmpty(),
            "カタログにない型がフィクスチャにあります: ${unknown.sorted()}",
        )
    }

    /**
     * 劣化が起きるとレンダラに渡る木がフィクスチャの記述と食い違い、ゴールデンが
     * 何を固定しているのか読めなくなる。互換性の劣化そのものは compat コーパスの担当。
     */
    @Test
    @DisplayName("VRT のフィクスチャが劣化なしで解決する")
    fun fixturesResolveWithoutDegradation() {
        for (case in cases) {
            val document = documentOf(case)
            val scope = EvalScope(data = document.data, state = document.state, env = envOf(case))
            val result = Resolver().resolve(document, scope)
            assertTrue(
                result.degradations.isEmpty(),
                "ケース ${string(case, "id")} で劣化が起きています: " +
                    result.degradations.map { "${it.nodeType} -> ${it.degradedTo.wireName}" },
            )
        }
    }

    @Test
    @DisplayName("ケースの id が一意で、全フィクスチャがいずれかのケースから参照される")
    fun casesReferenceEveryFixture() {
        val ids = cases.map { string(it, "id") }
        assertEquals(ids.size, ids.toSet().size, "ケースの id が重複しています: $ids")

        val referenced = cases.map { File(repoRoot, string(it, "document")).canonicalFile }.toSet()
        val present = File(vrtDir, "screens")
            .listFiles { f -> f.extension == "json" }
            .orEmpty()
            .map { it.canonicalFile }
            .toSet()
        assertEquals(
            present,
            referenced,
            "cases.json とフィクスチャの対応がずれています。" +
                " 参照されていない: ${(present - referenced).map { it.name }}" +
                " / 実体がない: ${(referenced - present).map { it.name }}",
        )
    }
}
