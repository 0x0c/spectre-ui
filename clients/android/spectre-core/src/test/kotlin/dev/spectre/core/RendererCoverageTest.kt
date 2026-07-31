package dev.spectre.core

import org.junit.jupiter.api.DisplayName
import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Compose レンダラの分岐がカタログを網羅していることを検証する。
 *
 * このテストが spectre-ui ではなく spectre-core にあるのは、Android SDK が
 * 無い環境でも実行できるようにするため。ソースを読んで突き合わせるだけなので
 * Compose のツールチェインを必要としない。
 *
 * 狙いは「マニフェストにコンポーネントを足したのに、レンダラの when に
 * 追加し忘れる」を落とすこと。カタログが対応済みと申告した型は必ず描画できる、
 * という不変条件を守る。
 */
class RendererCoverageTest {

    /** Screen はルート専用で SpectreScreen が直接扱うため、分岐表には現れない。 */
    private val rootOnly = setOf("Screen")

    private val rendererSource: String by lazy {
        val file = File(
            Conformance.corpusDir.parentFile.parentFile,
            "clients/android/spectre-ui/src/main/kotlin/dev/spectre/ui/SpectreNodeView.kt",
        )
        assertTrue(file.isFile, "レンダラのソースが見つかりません: ${file.absolutePath}")
        file.readText()
    }

    /** `"VStack" -> VStackView(...)` の形から、分岐が扱う型名を拾う。 */
    private val handledTypes: Set<String> by lazy {
        Regex("\"([A-Z][A-Za-z0-9]*)\"\\s*->").findAll(rendererSource)
            .map { it.groupValues[1] }
            .toSet()
    }

    @Test
    @DisplayName("カタログの全コンポーネントがレンダラで分岐している")
    fun rendererHandlesEveryCatalogComponent() {
        val missing = (GeneratedCatalog.componentNames - rootOnly) - handledTypes
        assertTrue(
            missing.isEmpty(),
            "レンダラに分岐がないコンポーネント: ${missing.sorted()}。" +
                " SpectreNodeView.kt に追加してください",
        )
    }

    @Test
    @DisplayName("レンダラがカタログにない型を分岐していない")
    fun rendererHandlesNoUnknownComponent() {
        val extra = handledTypes - GeneratedCatalog.componentNames
        assertTrue(
            extra.isEmpty(),
            "カタログにない型がレンダラにあります: ${extra.sorted()}。" +
                " マニフェストに追加するか分岐を消してください",
        )
    }

    @Test
    @DisplayName("サンプル画面に現れる型がすべて描画可能")
    fun sampleDocumentsUseOnlyRenderableTypes() {
        val examples = File(Conformance.examplesDir, "screens")
            .listFiles { f -> f.extension == "json" }
            .orEmpty()
        assertTrue(examples.isNotEmpty(), "サンプル画面が見つかりません")

        for (file in examples) {
            val document = DocumentParser.parse(file.readText())
            val result = Resolver().resolve(document, document.let {
                dev.spectre.core.expr.EvalScope(data = it.data, state = it.state)
            })
            val root = result.root ?: continue

            val used = collectTypes(root) - rootOnly
            val unrenderable = used - handledTypes
            assertTrue(
                unrenderable.isEmpty(),
                "${file.name} が描画できない型を含んでいます: ${unrenderable.sorted()}",
            )
        }
    }

    private fun collectTypes(node: RenderNode): Set<String> =
        setOf(node.type) +
            node.children.flatMap { collectTypes(it) } +
            node.nodeProps.values.flatten().flatMap { collectTypes(it) }
}
