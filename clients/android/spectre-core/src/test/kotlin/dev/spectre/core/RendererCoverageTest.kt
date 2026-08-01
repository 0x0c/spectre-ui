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

    private val repoRoot: File get() = Conformance.corpusDir.parentFile.parentFile

    private fun rendererSource(path: String): String {
        val file = File(repoRoot, path)
        assertTrue(file.isFile, "レンダラのソースが見つかりません: ${file.absolutePath}")
        return file.readText()
    }

    /** `"VStack" -> VStackView(...)` / `case "VStack":` の形から、分岐が扱う型名を拾う。 */
    private fun handledTypes(source: String, pattern: Regex): Set<String> =
        pattern.findAll(source).map { it.groupValues[1] }.toSet()

    private val composeHandled: Set<String> by lazy {
        handledTypes(
            rendererSource("clients/android/spectre-ui/src/main/kotlin/dev/spectre/ui/SpectreNodeView.kt"),
            Regex("\"([A-Z][A-Za-z0-9]*)\"\\s*->"),
        )
    }

    private val swiftUIHandled: Set<String> by lazy {
        handledTypes(
            rendererSource("clients/ios/Sources/SpectreUI/SpectreNodeView.swift"),
            Regex("case\\s+\"([A-Z][A-Za-z0-9]*)\"\\s*:"),
        )
    }

    /** 両プラットフォームで扱える型。サンプル画面の検証にはこちらを使う。 */
    private val handledTypes: Set<String> by lazy { composeHandled intersect swiftUIHandled }

    @Test
    @DisplayName("Compose レンダラがカタログの全コンポーネントを分岐している")
    fun composeRendererHandlesEveryCatalogComponent() {
        val missing = (GeneratedCatalog.componentNames - rootOnly) - composeHandled
        assertTrue(
            missing.isEmpty(),
            "Compose レンダラに分岐がないコンポーネント: ${missing.sorted()}。" +
                " SpectreNodeView.kt に追加してください",
        )
    }

    @Test
    @DisplayName("SwiftUI レンダラがカタログの全コンポーネントを分岐している")
    fun swiftUIRendererHandlesEveryCatalogComponent() {
        val missing = (GeneratedCatalog.componentNames - rootOnly) - swiftUIHandled
        assertTrue(
            missing.isEmpty(),
            "SwiftUI レンダラに分岐がないコンポーネント: ${missing.sorted()}。" +
                " SpectreNodeView.swift に追加してください",
        )
    }

    @Test
    @DisplayName("2つのレンダラが扱う型の集合が一致する")
    fun renderersAgreeOnHandledTypes() {
        val onlyCompose = composeHandled - swiftUIHandled
        val onlySwiftUI = swiftUIHandled - composeHandled
        assertTrue(
            onlyCompose.isEmpty() && onlySwiftUI.isEmpty(),
            "レンダラ間で扱える型がずれています。" +
                " Compose のみ: ${onlyCompose.sorted()} / SwiftUI のみ: ${onlySwiftUI.sorted()}",
        )
    }

    @Test
    @DisplayName("レンダラがカタログにない型を分岐していない")
    fun rendererHandlesNoUnknownComponent() {
        val extra = (composeHandled + swiftUIHandled) - GeneratedCatalog.componentNames
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
