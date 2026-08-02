package dev.spectre.core

import org.junit.jupiter.api.DynamicNode
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * spec/conformance/compat/ の全ケースを実行する (SU-0008)。
 *
 * `resolve/resolver.json` がノード解決の基本規則を検証するのに対し、こちらは
 * ケイパビリティ由来の劣化 (fallback → optional による省略 → プレースホルダ、
 * docs/compatibility.md §3, ADR-0006) だけに焦点を当てる。iOS/Android が同じ木・
 * 同じ degradations 列を出すことを保証する (SU-0007 の compat/ 区分)。ケースの実行そのものは
 * [Conformance.runResolveCase] を [ConformanceResolveTest] と共有する — 検証対象の写像
 * (document + capabilities -> 描画木 + degradations) が同じであるため。
 */
class ConformanceCompatTest {

    @TestFactory
    fun compatCorpus(): List<DynamicNode> =
        Conformance.loadDir("compat").flatMap { (fileName, doc) ->
            val cases = (doc.entries["cases"] as? SpValue.Arr)?.items.orEmpty()
            cases.mapIndexedNotNull { index, raw ->
                val case = raw as? SpValue.Obj ?: return@mapIndexedNotNull null
                val name = case.entries["name"]?.asStringOrNull ?: "case $index"
                DynamicTest.dynamicTest("$fileName: $name") { Conformance.runResolveCase(case) }
            }
        }
}
