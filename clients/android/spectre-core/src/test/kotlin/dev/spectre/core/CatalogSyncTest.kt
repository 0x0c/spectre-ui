package dev.spectre.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName

/**
 * 生成された [GeneratedCatalog] が spec/component-manifest.json と一致していることを検証する。
 *
 * 生成物はコミットする方針 (ADR-0002) なので、マニフェストだけ更新して
 * `node packages/codegen/generate.mjs` を忘れると静かにずれる。それを防ぐための番犬。
 * Node のツールチェインなしで動くよう、マニフェストを直接読んで突き合わせている。
 */
class CatalogSyncTest {

    private val manifest: SpValue.Obj by lazy {
        val file = File(Conformance.corpusDir.parentFile, "component-manifest.json")
        assertTrue(file.isFile, "マニフェストが見つかりません: ${file.absolutePath}")
        Conformance.parseObject(file.readText())
    }

    private val manifestComponents: List<SpValue.Obj>
        get() = (manifest.entries["components"] as SpValue.Arr).items.map { it as SpValue.Obj }

    @Test
    @DisplayName("カタログのコンポーネント一覧がマニフェストと一致する")
    fun componentNamesMatchManifest() {
        val expected = manifestComponents.mapNotNull { it.entries["name"]?.asStringOrNull }.toSet()
        assertEquals(
            expected,
            GeneratedCatalog.componentNames,
            "マニフェストと生成物がずれています。`node packages/codegen/generate.mjs` を実行してください",
        )
    }

    @Test
    @DisplayName("各コンポーネントの既知プロパティ名がマニフェストと一致する")
    fun propNamesMatchManifest() {
        for (component in manifestComponents) {
            val name = component.entries["name"]?.asStringOrNull ?: continue
            val expected = (component.entries["props"] as? SpValue.Obj)?.entries?.keys.orEmpty()
            val spec = GeneratedCatalog.spec(name)
            assertTrue(spec != null, "$name がカタログにありません")
            assertEquals(expected, spec.propNames, "$name のプロパティ名がずれています")
        }
    }

    @Test
    @DisplayName("アクション種別の一覧がマニフェストと一致する")
    fun actionNamesMatchManifest() {
        val expected = (manifest.entries["actions"] as SpValue.Arr).items
            .mapNotNull { (it as? SpValue.Obj)?.entries?.get("name")?.asStringOrNull }
            .toSet()
        assertEquals(expected, GeneratedCatalog.actionNames)
    }

    @Test
    @DisplayName("上限値がマニフェストと一致する")
    fun limitsMatchManifest() {
        val limits = manifest.entries["limits"] as SpValue.Obj
        assertEquals(limits.entries["maxNodes"]?.asIntOrNull, SpectreLimits.MAX_NODES)
        assertEquals(limits.entries["maxDepth"]?.asIntOrNull, SpectreLimits.MAX_DEPTH)
        assertEquals(limits.entries["maxDocumentBytes"]?.asIntOrNull, SpectreLimits.MAX_DOCUMENT_BYTES)
        assertEquals(limits.entries["maxRepeatItems"]?.asIntOrNull, SpectreLimits.MAX_REPEAT_ITEMS)
        assertEquals(
            limits.entries["maxActionsPerDispatch"]?.asIntOrNull,
            SpectreLimits.MAX_ACTIONS_PER_DISPATCH,
        )
    }

    @Test
    @DisplayName("ケイパビリティハッシュが対応集合の変化を検出する")
    fun capabilityHashReflectsSupportedSet() {
        val full = GeneratedCatalog.capabilityHash()
        val reduced = GeneratedCatalog.capabilityHash(GeneratedCatalog.componentNames - "Tabs")
        assertTrue(full != reduced, "対応集合が変わってもハッシュが変わっていません")
        assertEquals(full, GeneratedCatalog.capabilityHash(), "ハッシュが安定していません")
        assertEquals(8, full.length)
    }
}
