package dev.spectre.core.expr

import dev.spectre.core.SpValue
import dev.spectre.core.stringify

/**
 * `${...}` を含む文字列テンプレート。
 *
 * 文字列全体がちょうど1つの `${...}` なら [Whole] になり、評価結果の型が保存される。
 * それ以外は [Mixed] で、各部分を文字列化して連結する (docs/spec/expression.md §1)。
 */
sealed interface Template {
    /** 補間を含まない素の文字列。 */
    data class Literal(val text: String) : Template

    /** 文字列全体がひとつの式。型が保存される。 */
    data class Whole(val source: String) : Template

    data class Mixed(val parts: List<Part>) : Template

    sealed interface Part {
        data class Text(val text: String) : Part
        data class Expression(val source: String) : Part
    }
}

object TemplateParser {

    /**
     * テンプレート文字列を解析する。
     *
     * `$${` はリテラルの `${` へのエスケープ。
     */
    fun parse(source: String): Template {
        if (!source.contains('$')) return Template.Literal(source)

        val parts = ArrayList<Template.Part>()
        val text = StringBuilder()
        var i = 0

        fun flushText() {
            if (text.isNotEmpty()) {
                parts.add(Template.Part.Text(text.toString()))
                text.clear()
            }
        }

        while (i < source.length) {
            val c = source[i]
            if (c == '$' && i + 2 < source.length && source[i + 1] == '$' && source[i + 2] == '{') {
                text.append("\${")
                i += 3
                continue
            }
            if (c == '$' && i + 1 < source.length && source[i + 1] == '{') {
                val end = findClosingBrace(source, i + 2)
                if (end < 0) {
                    // 閉じられていない '${' はリテラルとして扱う。ここで例外にすると
                    // 「$1,000 のような文字列を書いたら画面が落ちる」ことになる。
                    text.append(source.substring(i))
                    break
                }
                flushText()
                parts.add(Template.Part.Expression(source.substring(i + 2, end)))
                i = end + 1
                continue
            }
            text.append(c)
            i++
        }
        flushText()

        return when {
            parts.isEmpty() -> Template.Literal("")
            parts.size == 1 && parts[0] is Template.Part.Expression ->
                Template.Whole((parts[0] as Template.Part.Expression).source)
            parts.all { it is Template.Part.Text } ->
                Template.Literal(parts.joinToString("") { (it as Template.Part.Text).text })
            else -> Template.Mixed(parts)
        }
    }

    /**
     * `${` に対応する `}` の位置を返す。見つからなければ -1。
     *
     * 式の中のオブジェクトリテラル `{...}` と文字列リテラル内の `}` を正しく読み飛ばす。
     */
    private fun findClosingBrace(source: String, start: Int): Int {
        var depth = 0
        var i = start
        while (i < source.length) {
            when (val c = source[i]) {
                '\'', '"' -> {
                    i++
                    while (i < source.length && source[i] != c) {
                        if (source[i] == '\\') i++
                        i++
                    }
                }
                '{' -> depth++
                '}' -> {
                    if (depth == 0) return i
                    depth--
                }
            }
            i++
        }
        return -1
    }
}

/**
 * テンプレートの評価。式のパースは [ExprCache] を通すため、同じ文字列の再パースは起きない。
 */
class TemplateEvaluator(
    private val cache: ExprCache = ExprCache(),
    private val evaluator: ExprEvaluator = ExprEvaluator(),
) {
    private val templates = HashMap<String, Template>()

    fun templateOf(source: String): Template = templates.getOrPut(source) { TemplateParser.parse(source) }

    fun evaluate(source: String, scope: EvalScope): EvalResult =
        evaluate(templateOf(source), scope)

    fun evaluate(template: Template, scope: EvalScope): EvalResult = when (template) {
        is Template.Literal -> EvalResult(SpValue.Str(template.text))

        is Template.Whole -> evaluateExpression(template.source, scope)

        is Template.Mixed -> {
            val errors = ArrayList<ExprError>()
            val sb = StringBuilder()
            for (part in template.parts) {
                when (part) {
                    is Template.Part.Text -> sb.append(part.text)
                    is Template.Part.Expression -> {
                        val result = evaluateExpression(part.source, scope)
                        errors.addAll(result.errors)
                        sb.append(result.value.stringify())
                    }
                }
            }
            EvalResult(SpValue.Str(sb.toString()), errors)
        }
    }

    private fun evaluateExpression(source: String, scope: EvalScope): EvalResult =
        cache.get(source).fold(
            onSuccess = { evaluator.evaluate(it, scope) },
            onFailure = { throwable ->
                val error = (throwable as? ExprParseException)?.error
                    ?: ExprError(ExprErrorCode.E_PARSE, throwable.message ?: "式を解析できません")
                EvalResult(SpValue.Null, listOf(error))
            },
        )

    /** ドキュメント読み込み時に全式を事前解析し、パースエラーを一括検出する。 */
    fun precompile(source: String): List<ExprError> {
        val errors = ArrayList<ExprError>()
        fun check(exprSource: String) {
            cache.get(exprSource).onFailure { throwable ->
                errors.add(
                    (throwable as? ExprParseException)?.error
                        ?: ExprError(ExprErrorCode.E_PARSE, throwable.message ?: "式を解析できません")
                )
            }
        }
        when (val template = templateOf(source)) {
            is Template.Literal -> Unit
            is Template.Whole -> check(template.source)
            is Template.Mixed -> template.parts
                .filterIsInstance<Template.Part.Expression>()
                .forEach { check(it.source) }
        }
        return errors
    }

    /** この文字列が依存するスコープ相対パスの集合。差分再解決に使う。 */
    fun dependencies(source: String): Set<String> {
        val out = LinkedHashSet<String>()
        fun collect(exprSource: String) {
            cache.get(exprSource).onSuccess { out.addAll(it.dependencies()) }
        }
        when (val template = templateOf(source)) {
            is Template.Literal -> Unit
            is Template.Whole -> collect(template.source)
            is Template.Mixed -> template.parts
                .filterIsInstance<Template.Part.Expression>()
                .forEach { collect(it.source) }
        }
        return out
    }
}
