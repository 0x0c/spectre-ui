package dev.spectre.core

import dev.spectre.core.expr.EvalScope
import dev.spectre.core.expr.TemplateEvaluator
import org.junit.jupiter.api.DynamicNode
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * spec/conformance/expr の全ケースを実行する。
 *
 * このテストが SpectreExpr の仕様そのもの。仕様を変えるならコーパスにケースを
 * 足さなければならず、逆にコーパスを満たさない実装は仕様違反になる。
 */
class ConformanceExprTest {

    @TestFactory
    fun expressionCorpus(): List<DynamicNode> =
        Conformance.loadDir("expr").flatMap { (fileName, doc) ->
            val advisory = doc.entries["advisory"]?.asBoolOrNull ?: false
            val scope = scopeOf(doc.entries["scope"] as? SpValue.Obj)
            val cases = (doc.entries["cases"] as? SpValue.Arr)?.items.orEmpty()

            cases.mapIndexedNotNull { index, raw ->
                val case = raw as? SpValue.Obj ?: return@mapIndexedNotNull null
                val source = case.entries["expr"]?.asStringOrNull ?: return@mapIndexedNotNull null
                DynamicTest.dynamicTest("$fileName[$index] $source") {
                    runCase(case, source, scope, advisory)
                }
            }
        }

    private fun runCase(case: SpValue.Obj, source: String, scope: EvalScope, advisory: Boolean) {
        // 評価器はケースごとに作る。キャッシュ越しの状態が結果に影響しないことも同時に確認できる。
        val evaluator = TemplateEvaluator()
        val result = evaluator.evaluate(source, scope)

        case.entries["expect"]?.let { expected ->
            assertTrue(
                Conformance.valuesEqual(result.value, expected),
                "式 `$source` の評価結果が期待と異なります\n" +
                    "  期待: ${Conformance.describe(expected)}\n" +
                    "  実際: ${Conformance.describe(result.value)}",
            )
        }

        val expectedError = case.entries["error"]?.asStringOrNull
        if (expectedError != null) {
            assertTrue(
                result.errors.any { it.code.name == expectedError },
                "式 `$source` は $expectedError を記録するはずですが、記録されたのは " +
                    "${result.errors.map { it.code.name }} でした",
            )
        } else if (!advisory) {
            assertTrue(
                result.errors.isEmpty(),
                "式 `$source` はエラーなく評価されるはずですが " +
                    "${result.errors.map { "${it.code}: ${it.message}" }} が記録されました",
            )
        }

        case.entries["asBoolean"]?.asBoolOrNull?.let { expected ->
            assertEquals(
                expected,
                result.value.isTruthy,
                "式 `$source` の真偽判定が期待と異なります",
            )
        }

        // ロケール依存の書式は完全一致を要求せず、部分一致だけを検査する。
        (case.entries["contains"] as? SpValue.Arr)?.items?.forEach { needle ->
            val text = result.value.stringify()
            val expected = needle.asStringOrNull ?: fail("contains は文字列の配列です")
            assertTrue(
                text.contains(expected),
                "式 `$source` の結果 \"$text\" に \"$expected\" が含まれていません",
            )
        }

        case.entries["matches"]?.asStringOrNull?.let { pattern ->
            val text = result.value.stringify()
            assertTrue(
                Regex(pattern).matches(text),
                "式 `$source` の結果 \"$text\" が /$pattern/ にマッチしません",
            )
        }
    }

    private fun scopeOf(raw: SpValue.Obj?): EvalScope = EvalScope(
        data = raw?.entries?.get("data") as? SpValue.Obj ?: SpValue.EmptyObj,
        state = raw?.entries?.get("state") as? SpValue.Obj ?: SpValue.EmptyObj,
        env = raw?.entries?.get("env") as? SpValue.Obj ?: SpValue.EmptyObj,
    )
}
