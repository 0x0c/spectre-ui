package dev.spectre.core

import org.junit.jupiter.api.DynamicNode
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * spec/conformance/resolve/resolver.json の全ケースを実行する。
 *
 * 検証対象は「未解決ドキュメント + 状態 -> 正規化された描画木」の写像。
 * レイアウト計算の前段までなので、プラットフォーム間で完全一致を要求できる。
 * ケースの実行そのものは [Conformance.runResolveCase] を [ConformanceCompatTest] と共有する。
 */
class ConformanceResolveTest {

    @TestFactory
    fun resolverCorpus(): List<DynamicNode> {
        val doc = Conformance.loadDir("resolve").first { it.first == "resolver.json" }.second
        val cases = (doc.entries["cases"] as? SpValue.Arr)?.items.orEmpty()

        return cases.mapIndexedNotNull { index, raw ->
            val case = raw as? SpValue.Obj ?: return@mapIndexedNotNull null
            val name = case.entries["name"]?.asStringOrNull ?: "case $index"
            DynamicTest.dynamicTest(name) { Conformance.runResolveCase(case) }
        }
    }
}
