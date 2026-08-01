package dev.spectre.core.expr

import dev.spectre.core.SpValue
import dev.spectre.core.isTruthy
import dev.spectre.core.stringify

/**
 * 式評価のスコープ。
 *
 * `data` は不変、`state` は可変、`item`/`index` は repeat の内側でのみ導入される。
 * `error` は request の onError ハンドラ内でのみ存在する。
 */
data class EvalScope(
    val data: SpValue = SpValue.EmptyObj,
    val state: SpValue = SpValue.EmptyObj,
    val env: SpValue = SpValue.EmptyObj,
    val locals: Map<String, SpValue> = emptyMap(),
) {
    fun withLocals(extra: Map<String, SpValue>): EvalScope = copy(locals = locals + extra)

    fun lookup(name: String): SpValue? = when (name) {
        "data" -> data
        "state" -> state
        "env" -> env
        else -> locals[name]
    }
}

data class EvalResult(val value: SpValue, val errors: List<ExprError> = emptyList()) {
    val hasError: Boolean get() = errors.isNotEmpty()
}

/**
 * SpectreExpr の評価器。
 *
 * 評価は例外を投げない。エラーは値 [SpValue.Null] と [ExprError] の記録として現れる
 * (docs/spec/expression.md §5)。壊れた式で画面全体が落ちるより、その部分だけが
 * 空になるほうが害が小さいという判断。
 */
class ExprEvaluator(private val functions: BuiltinFunctions = BuiltinFunctions()) {

    fun evaluate(expr: Expr, scope: EvalScope): EvalResult {
        val errors = ArrayList<ExprError>()
        val value = eval(expr, scope, errors)
        return EvalResult(value, errors)
    }

    private fun eval(expr: Expr, scope: EvalScope, errors: MutableList<ExprError>): SpValue = when (expr) {
        is Expr.Literal -> expr.value

        is Expr.Identifier -> scope.lookup(expr.name) ?: SpValue.Null

        is Expr.Member -> when (val target = eval(expr.target, scope, errors)) {
            is SpValue.Obj -> target.entries[expr.name] ?: SpValue.Null
            // null や非オブジェクトへのアクセスは null。'.' と '?.' の動作は同じで、
            // '?.' は読み手に意図を伝えるための糖衣構文 (docs/spec/expression.md §3)。
            else -> SpValue.Null
        }

        is Expr.Index -> {
            val target = eval(expr.target, scope, errors)
            val index = eval(expr.index, scope, errors)
            when {
                target is SpValue.Arr && index is SpValue.Num -> {
                    val i = index.value.toInt()
                    if (i >= 0 && i < target.items.size) target.items[i] else SpValue.Null
                }
                target is SpValue.Obj && index is SpValue.Str -> target.entries[index.value] ?: SpValue.Null
                target is SpValue.Str && index is SpValue.Num -> {
                    val i = index.value.toInt()
                    if (i >= 0 && i < target.value.length) SpValue.Str(target.value[i].toString()) else SpValue.Null
                }
                else -> SpValue.Null
            }
        }

        is Expr.Call -> {
            val args = expr.args.map { eval(it, scope, errors) }
            functions.invoke(expr.name, args, scope, errors)
        }

        is Expr.Unary -> when (expr.op) {
            "!" -> SpValue.Bool(!eval(expr.operand, scope, errors).isTruthy)
            "-" -> when (val v = eval(expr.operand, scope, errors)) {
                is SpValue.Num -> SpValue.Num(-v.value)
                else -> typeError(errors, "単項 '-' は数値にのみ適用できます")
            }
            else -> typeError(errors, "未知の単項演算子 '${expr.op}'")
        }

        is Expr.Binary -> evalBinary(expr, scope, errors)

        is Expr.Ternary ->
            if (eval(expr.condition, scope, errors).isTruthy) eval(expr.ifTrue, scope, errors)
            else eval(expr.ifFalse, scope, errors)

        is Expr.ArrayLit -> SpValue.Arr(expr.items.map { eval(it, scope, errors) })

        is Expr.ObjectLit -> SpValue.Obj(
            expr.entries.associate { (k, v) -> k to eval(v, scope, errors) }
        )
    }

    private fun evalBinary(expr: Expr.Binary, scope: EvalScope, errors: MutableList<ExprError>): SpValue {
        // && と || は短絡評価する。右辺は必要になるまで評価しない。
        if (expr.op == "&&") {
            val left = eval(expr.left, scope, errors)
            if (!left.isTruthy) return SpValue.Bool(false)
            return SpValue.Bool(eval(expr.right, scope, errors).isTruthy)
        }
        if (expr.op == "||") {
            val left = eval(expr.left, scope, errors)
            if (left.isTruthy) return SpValue.Bool(true)
            return SpValue.Bool(eval(expr.right, scope, errors).isTruthy)
        }

        val l = eval(expr.left, scope, errors)
        val r = eval(expr.right, scope, errors)

        return when (expr.op) {
            "==" -> SpValue.Bool(deepEquals(l, r))
            "!=" -> SpValue.Bool(!deepEquals(l, r))

            "+" -> when {
                l is SpValue.Num && r is SpValue.Num -> SpValue.Num(l.value + r.value)
                // どちらかが文字列なら連結。数値との連結は日常的に必要なため許す。
                l is SpValue.Str && (r is SpValue.Str || r is SpValue.Num) ->
                    SpValue.Str(l.value + r.stringify())
                r is SpValue.Str && l is SpValue.Num -> SpValue.Str(l.stringify() + r.value)
                else -> typeError(errors, "'+' は数値同士か、文字列と数値/文字列にのみ適用できます")
            }

            "-", "*", "/", "%" -> {
                if (l !is SpValue.Num || r !is SpValue.Num) {
                    typeError(errors, "'${expr.op}' は数値にのみ適用できます")
                } else if ((expr.op == "/" || expr.op == "%") && r.value == 0.0) {
                    // 0 除算は例外にせず null。表示が空になるだけで画面は壊れない。
                    typeError(errors, "0 で除算しました")
                } else {
                    SpValue.Num(
                        when (expr.op) {
                            "-" -> l.value - r.value
                            "*" -> l.value * r.value
                            "/" -> l.value / r.value
                            else -> l.value % r.value
                        }
                    )
                }
            }

            "<", "<=", ">", ">=" -> compare(l, r, expr.op, errors)

            else -> typeError(errors, "未知の二項演算子 '${expr.op}'")
        }
    }

    private fun compare(
        l: SpValue,
        r: SpValue,
        op: String,
        errors: MutableList<ExprError>,
    ): SpValue {
        val cmp: Int = when {
            l is SpValue.Num && r is SpValue.Num -> l.value.compareTo(r.value)
            l is SpValue.Str && r is SpValue.Str -> l.value.compareTo(r.value)
            else -> return typeError(errors, "'$op' は同じ型 (数値同士・文字列同士) にのみ適用できます")
        }
        return SpValue.Bool(
            when (op) {
                "<" -> cmp < 0
                "<=" -> cmp <= 0
                ">" -> cmp > 0
                else -> cmp >= 0
            }
        )
    }

    private fun typeError(errors: MutableList<ExprError>, message: String): SpValue {
        errors.add(ExprError(ExprErrorCode.E_TYPE, message))
        return SpValue.Null
    }
}

/** 型変換をしない厳密比較。配列/オブジェクトは構造的に比較する。 */
fun deepEquals(a: SpValue, b: SpValue): Boolean = when {
    a is SpValue.Null && b is SpValue.Null -> true
    a is SpValue.Bool && b is SpValue.Bool -> a.value == b.value
    a is SpValue.Num && b is SpValue.Num -> a.value == b.value
    a is SpValue.Str && b is SpValue.Str -> a.value == b.value
    a is SpValue.Arr && b is SpValue.Arr ->
        a.items.size == b.items.size && a.items.indices.all { deepEquals(a.items[it], b.items[it]) }
    a is SpValue.Obj && b is SpValue.Obj ->
        a.entries.keys == b.entries.keys &&
            a.entries.all { (k, v) -> deepEquals(v, b.entries.getValue(k)) }
    else -> false
}
