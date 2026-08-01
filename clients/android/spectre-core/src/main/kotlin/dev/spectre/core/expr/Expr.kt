package dev.spectre.core.expr

import dev.spectre.core.SpValue

/**
 * SpectreExpr の抽象構文木。
 *
 * ラムダ・関数定義・代入・ループを持たないため、評価は AST のサイズに比例した
 * 有限時間で必ず停止する (docs/spec/expression.md §3)。
 */
sealed interface Expr {
    data class Literal(val value: SpValue) : Expr
    data class Identifier(val name: String) : Expr
    data class Member(val target: Expr, val name: String, val nullSafe: Boolean) : Expr
    data class Index(val target: Expr, val index: Expr) : Expr

    /** 呼び出せるのは組み込み関数だけ。任意の式を callee にはできない。 */
    data class Call(val name: String, val args: List<Expr>) : Expr
    data class Unary(val op: String, val operand: Expr) : Expr
    data class Binary(val op: String, val left: Expr, val right: Expr) : Expr
    data class Ternary(val condition: Expr, val ifTrue: Expr, val ifFalse: Expr) : Expr
    data class ArrayLit(val items: List<Expr>) : Expr
    data class ObjectLit(val entries: List<Pair<String, Expr>>) : Expr
}

enum class ExprErrorCode { E_PARSE, E_TYPE, E_UNKNOWN_FN, E_DEPTH }

data class ExprError(val code: ExprErrorCode, val message: String)

class ExprParseException(val error: ExprError) : Exception(error.message)

/**
 * この式が参照しているスコープ相対パスの集合 (`state.form.email` など)。
 *
 * Store の変更時に、影響を受けるノードだけを再解決するために使う
 * (docs/spec/expression.md §6)。動的な添字 (`arr[state.i]`) を含む枝は
 * その手前までのパスに丸める — 過剰に再解決されることはあっても、
 * 取りこぼしは起きない側に倒している。
 */
fun Expr.dependencies(): Set<String> {
    val out = LinkedHashSet<String>()
    collectDependencies(this, out)
    return out
}

private fun collectDependencies(expr: Expr, out: MutableSet<String>) {
    val path = staticPathOf(expr)
    if (path != null) {
        out.add(path)
        // パスが取れた枝でも、添字の中に別の参照がありうる
    }
    when (expr) {
        is Expr.Literal, is Expr.Identifier -> Unit
        is Expr.Member -> if (path == null) collectDependencies(expr.target, out)
        is Expr.Index -> {
            if (path == null) collectDependencies(expr.target, out)
            collectDependencies(expr.index, out)
        }
        is Expr.Call -> expr.args.forEach { collectDependencies(it, out) }
        is Expr.Unary -> collectDependencies(expr.operand, out)
        is Expr.Binary -> {
            collectDependencies(expr.left, out)
            collectDependencies(expr.right, out)
        }
        is Expr.Ternary -> {
            collectDependencies(expr.condition, out)
            collectDependencies(expr.ifTrue, out)
            collectDependencies(expr.ifFalse, out)
        }
        is Expr.ArrayLit -> expr.items.forEach { collectDependencies(it, out) }
        is Expr.ObjectLit -> expr.entries.forEach { collectDependencies(it.second, out) }
    }
}

/** `data.a.b` のような静的に決まるパスを文字列で返す。決まらなければ null。 */
private fun staticPathOf(expr: Expr): String? = when (expr) {
    is Expr.Identifier -> expr.name
    is Expr.Member -> staticPathOf(expr.target)?.let { "$it.${expr.name}" }
    is Expr.Index -> {
        val literal = (expr.index as? Expr.Literal)?.value
        val key = (literal as? SpValue.Str)?.value
        if (key != null) staticPathOf(expr.target)?.let { "$it.$key" } else null
    }
    else -> null
}
