package dev.spectre.core.expr

import dev.spectre.core.SpValue
import dev.spectre.core.formatNumberPlain
import dev.spectre.core.isBlank
import dev.spectre.core.isTruthy
import dev.spectre.core.path
import dev.spectre.core.stringify
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

/**
 * 組み込み関数のホワイトリスト。
 *
 * ユーザ定義関数もラムダも存在しないため、ここに列挙された関数がクライアントで
 * 実行されうる処理のすべてになる (docs/spec/expression.md §4)。
 *
 * `map` / `filter` / `reduce` を意図的に持たない。それらはラムダを要求して言語を
 * 一気に大きくするため、配列の加工はサーバ側で行い `data` に入れて送る。
 */
class BuiltinFunctions {

    fun invoke(
        name: String,
        args: List<SpValue>,
        scope: EvalScope,
        errors: MutableList<ExprError>,
    ): SpValue {
        val ctx = Ctx(name, args, scope, errors)
        return when (name) {
            // -- 文字列 ------------------------------------------------------
            "len", "count" -> ctx.arity(1) {
                when (val v = args[0]) {
                    is SpValue.Str -> SpValue.Num(v.value.length.toDouble())
                    is SpValue.Arr -> SpValue.Num(v.items.size.toDouble())
                    is SpValue.Obj -> SpValue.Num(v.entries.size.toDouble())
                    is SpValue.Null -> SpValue.Num(0.0)
                    else -> ctx.typeError("len は文字列・配列・オブジェクトにのみ適用できます")
                }
            }
            "upper" -> ctx.arity(1) { ctx.str(0)?.let { SpValue.Str(it.uppercase()) } ?: ctx.typeError() }
            "lower" -> ctx.arity(1) { ctx.str(0)?.let { SpValue.Str(it.lowercase()) } ?: ctx.typeError() }
            "trim" -> ctx.arity(1) { ctx.str(0)?.let { SpValue.Str(it.trim()) } ?: ctx.typeError() }

            "contains" -> ctx.arity(2) {
                when (val target = args[0]) {
                    is SpValue.Str -> ctx.str(1)?.let { SpValue.Bool(target.value.contains(it)) } ?: ctx.typeError()
                    is SpValue.Arr -> SpValue.Bool(target.items.any { deepEquals(it, args[1]) })
                    else -> ctx.typeError("contains は文字列または配列にのみ適用できます")
                }
            }
            "startsWith" -> ctx.arity(2) {
                val s = ctx.str(0); val p = ctx.str(1)
                if (s == null || p == null) ctx.typeError() else SpValue.Bool(s.startsWith(p))
            }
            "endsWith" -> ctx.arity(2) {
                val s = ctx.str(0); val p = ctx.str(1)
                if (s == null || p == null) ctx.typeError() else SpValue.Bool(s.endsWith(p))
            }
            "join" -> ctx.arity(2) {
                val arr = ctx.arr(0); val sep = ctx.str(1)
                if (arr == null || sep == null) ctx.typeError()
                else SpValue.Str(arr.joinToString(sep) { it.stringify() })
            }
            "split" -> ctx.arity(2) {
                val s = ctx.str(0); val sep = ctx.str(1)
                if (s == null || sep == null) ctx.typeError()
                else SpValue.Arr(s.split(sep).map { SpValue.Str(it) })
            }
            "replace" -> ctx.arity(3) {
                val s = ctx.str(0); val from = ctx.str(1); val to = ctx.str(2)
                // 正規表現ではなく単純な部分文字列置換。式言語に正規表現は入れない。
                if (s == null || from == null || to == null) ctx.typeError()
                else SpValue.Str(s.replace(from, to))
            }
            "slice" -> ctx.arityRange(2, 3) { slice(ctx) }

            // -- 数値 --------------------------------------------------------
            "min" -> ctx.arity(2) { ctx.nums2()?.let { (a, b) -> SpValue.Num(minOf(a, b)) } ?: ctx.typeError() }
            "max" -> ctx.arity(2) { ctx.nums2()?.let { (a, b) -> SpValue.Num(maxOf(a, b)) } ?: ctx.typeError() }
            "abs" -> ctx.arity(1) { ctx.num(0)?.let { SpValue.Num(Math.abs(it)) } ?: ctx.typeError() }
            "floor" -> ctx.arity(1) { ctx.num(0)?.let { SpValue.Num(Math.floor(it)) } ?: ctx.typeError() }
            "ceil" -> ctx.arity(1) { ctx.num(0)?.let { SpValue.Num(Math.ceil(it)) } ?: ctx.typeError() }
            "round" -> ctx.arityRange(1, 2) { round(ctx) }
            "sum" -> ctx.arity(1) { sum(ctx) }
            "toNumber" -> ctx.arity(1) { toNumber(args[0]) }
            "toString" -> ctx.arity(1) { SpValue.Str(args[0].stringify()) }

            // -- 論理・コレクション -------------------------------------------
            "if" -> ctx.arity(3) { if (args[0].isTruthy) args[1] else args[2] }
            "coalesce" -> ctx.atLeast(1) { args.firstOrNull { it !is SpValue.Null } ?: SpValue.Null }
            "default" -> ctx.arity(2) { if (args[0].isBlank) args[1] else args[0] }
            "has" -> ctx.arity(2) {
                val obj = args[0] as? SpValue.Obj
                val key = ctx.str(1)
                if (obj == null || key == null) ctx.typeError()
                else SpValue.Bool(obj.entries.containsKey(key))
            }
            "get" -> ctx.arityRange(2, 3) {
                val p = ctx.str(1) ?: return@arityRange ctx.typeError()
                val found = args[0].path(p)
                if (found is SpValue.Null && args.size == 3) args[2] else found
            }
            "first" -> ctx.arity(1) { ctx.arr(0)?.firstOrNull() ?: SpValue.Null }
            "last" -> ctx.arity(1) { ctx.arr(0)?.lastOrNull() ?: SpValue.Null }
            "indexOf" -> ctx.arity(2) {
                val arr = ctx.arr(0) ?: return@arity ctx.typeError()
                SpValue.Num(arr.indexOfFirst { deepEquals(it, args[1]) }.toDouble())
            }

            // -- 環境 --------------------------------------------------------
            "isPlatform" -> ctx.arity(1) {
                SpValue.Bool(scope.env.path("platform").stringify() == args[0].stringify())
            }
            "versionAtLeast" -> ctx.arity(1) {
                SpValue.Bool(compareVersions(scope.env.path("appVersion").stringify(), args[0].stringify()) >= 0)
            }

            // -- 書式 (ロケール依存。ネイティブのフォーマッタに委譲) ------------
            "formatNumber" -> ctx.arityRange(1, 2) { formatNumber(ctx) }
            "formatCurrency" -> ctx.arity(2) { formatCurrency(ctx) }
            "formatPercent" -> ctx.arityRange(1, 2) { formatPercent(ctx) }
            "formatDate" -> ctx.arity(2) { formatDate(ctx) }
            "plural" -> ctx.arity(2) { plural(ctx) }

            else -> {
                // 新しいスキーマバージョンで追加された関数を古いクライアントが受け取った場合もここに来る。
                errors.add(ExprError(ExprErrorCode.E_UNKNOWN_FN, "未知の関数 '$name'"))
                SpValue.Null
            }
        }
    }

    // -- 個別実装 ------------------------------------------------------------

    private fun slice(ctx: Ctx): SpValue {
        val start = ctx.num(1)?.toInt() ?: return ctx.typeError()
        val end = if (ctx.args.size == 3) ctx.num(2)?.toInt() ?: return ctx.typeError() else null
        return when (val target = ctx.args[0]) {
            is SpValue.Str -> {
                val from = start.coerceIn(0, target.value.length)
                val to = (end ?: target.value.length).coerceIn(from, target.value.length)
                SpValue.Str(target.value.substring(from, to))
            }
            is SpValue.Arr -> {
                val from = start.coerceIn(0, target.items.size)
                val to = (end ?: target.items.size).coerceIn(from, target.items.size)
                SpValue.Arr(target.items.subList(from, to).toList())
            }
            else -> ctx.typeError("slice は文字列または配列にのみ適用できます")
        }
    }

    private fun round(ctx: Ctx): SpValue {
        val n = ctx.num(0) ?: return ctx.typeError()
        val digits = if (ctx.args.size == 2) ctx.num(1)?.toInt() ?: return ctx.typeError() else 0
        if (digits == 0) return SpValue.Num(roundHalfUp(n))
        val factor = Math.pow(10.0, digits.toDouble())
        return SpValue.Num(roundHalfUp(n * factor) / factor)
    }

    /** half-up (+∞方向)。Kotlin/Swift/JS の Math.round と同じ挙動に揃えている。 */
    private fun roundHalfUp(v: Double): Double = Math.floor(v + 0.5)

    private fun sum(ctx: Ctx): SpValue {
        val arr = ctx.arr(0) ?: return ctx.typeError()
        var total = 0.0
        for (item in arr) {
            val n = (item as? SpValue.Num)?.value ?: return ctx.typeError("sum は数値の配列にのみ適用できます")
            total += n
        }
        return SpValue.Num(total)
    }

    private fun toNumber(value: SpValue): SpValue = when (value) {
        is SpValue.Num -> value
        // 変換失敗は null。エラーではなく値として扱う (docs/spec/expression.md §4)。
        is SpValue.Str -> value.value.trim().toDoubleOrNull()?.let { SpValue.Num(it) } ?: SpValue.Null
        is SpValue.Bool -> SpValue.Num(if (value.value) 1.0 else 0.0)
        else -> SpValue.Null
    }

    private fun formatNumber(ctx: Ctx): SpValue {
        val n = ctx.num(0) ?: return ctx.typeError()
        val opts = ctx.args.getOrNull(1) as? SpValue.Obj
        val fmt = NumberFormat.getNumberInstance(ctx.locale)
        opts?.entries?.get("grouping")?.let { fmt.isGroupingUsed = it.isTruthy }
        opts?.entries?.get("minFractionDigits")?.let {
            (it as? SpValue.Num)?.let { v -> fmt.minimumFractionDigits = v.value.toInt() }
        }
        val maxDigits = (opts?.entries?.get("maxFractionDigits") as? SpValue.Num)?.value?.toInt()
        fmt.maximumFractionDigits = maxDigits ?: 3
        return SpValue.Str(fmt.format(n))
    }

    private fun formatCurrency(ctx: Ctx): SpValue {
        val n = ctx.num(0) ?: return ctx.typeError()
        val code = ctx.str(1) ?: return ctx.typeError()
        val currency = runCatching { Currency.getInstance(code) }.getOrNull()
            ?: return ctx.typeError("未知の通貨コード '$code'")
        val fmt = NumberFormat.getCurrencyInstance(ctx.locale)
        fmt.currency = currency
        fmt.maximumFractionDigits = currency.defaultFractionDigits
        fmt.minimumFractionDigits = currency.defaultFractionDigits
        return SpValue.Str(fmt.format(n))
    }

    private fun formatPercent(ctx: Ctx): SpValue {
        val n = ctx.num(0) ?: return ctx.typeError()
        val digits = if (ctx.args.size == 2) ctx.num(1)?.toInt() ?: return ctx.typeError() else 0
        val fmt = NumberFormat.getPercentInstance(ctx.locale)
        fmt.minimumFractionDigits = digits
        fmt.maximumFractionDigits = digits
        return SpValue.Str(fmt.format(n))
    }

    private fun formatDate(ctx: Ctx): SpValue {
        val iso = ctx.str(0) ?: return ctx.typeError()
        val style = ctx.str(1) ?: return ctx.typeError()
        val instant = runCatching { Instant.parse(iso) }.getOrNull()
            ?: return ctx.typeError("ISO 8601 として解釈できません: $iso")
        val zoned = instant.atZone(ctx.zone)
        if (style == "relative") return SpValue.Str(relativeDescription(instant))
        val formatStyle = when (style) {
            "short" -> FormatStyle.SHORT
            "medium" -> FormatStyle.MEDIUM
            "long" -> FormatStyle.LONG
            else -> return ctx.typeError("未知の日付スタイル '$style'")
        }
        val formatter = DateTimeFormatter.ofLocalizedDate(formatStyle).withLocale(ctx.locale)
        return SpValue.Str(zoned.format(formatter))
    }

    private fun relativeDescription(instant: Instant): String {
        val seconds = Instant.now().epochSecond - instant.epochSecond
        val past = seconds >= 0
        val abs = Math.abs(seconds)
        val (amount, unit) = when {
            abs < 60 -> abs to "秒"
            abs < 3600 -> abs / 60 to "分"
            abs < 86400 -> abs / 3600 to "時間"
            else -> abs / 86400 to "日"
        }
        return if (past) "$amount${unit}前" else "$amount${unit}後"
    }

    private fun plural(ctx: Ctx): SpValue {
        val n = ctx.num(0) ?: return ctx.typeError()
        val forms = ctx.args[1] as? SpValue.Obj ?: return ctx.typeError("plural の第2引数は形式のオブジェクトです")
        val category = pluralCategory(n, ctx.locale.language)
        val form = forms.entries[category] ?: forms.entries["other"] ?: return SpValue.Null
        // ICU の '#' と同じく、選ばれた形式の中の '#' を数値に置換する。
        return SpValue.Str(form.stringify().replace("#", formatNumberPlain(n)))
    }

    /** v0.1 は最小限の CLDR 近似。複数形のない言語では常に other。 */
    private fun pluralCategory(n: Double, language: String): String = when (language) {
        "ja", "zh", "ko", "th", "vi", "id", "ms" -> "other"
        else -> if (n == 1.0) "one" else "other"
    }

    private fun compareVersions(a: String, b: String): Int {
        val left = a.split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
        val right = b.split('.').map { it.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(left.size, right.size)) {
            val cmp = (left.getOrNull(i) ?: 0).compareTo(right.getOrNull(i) ?: 0)
            if (cmp != 0) return cmp
        }
        return 0
    }

    // -- 引数ヘルパ ----------------------------------------------------------

    private inner class Ctx(
        val name: String,
        val args: List<SpValue>,
        val scope: EvalScope,
        val errors: MutableList<ExprError>,
    ) {
        val locale: Locale
            get() = scope.env.path("locale").let { (it as? SpValue.Str)?.value }
                ?.let { Locale.forLanguageTag(it) }
                ?.takeIf { it.language.isNotEmpty() }
                ?: Locale.US

        val zone: ZoneId
            get() = scope.env.path("timeZone").let { (it as? SpValue.Str)?.value }
                ?.let { runCatching { ZoneId.of(it) }.getOrNull() }
                ?: ZoneId.of("UTC")

        fun str(i: Int): String? = (args.getOrNull(i) as? SpValue.Str)?.value
        fun num(i: Int): Double? = (args.getOrNull(i) as? SpValue.Num)?.value
        fun arr(i: Int): List<SpValue>? = (args.getOrNull(i) as? SpValue.Arr)?.items
        fun nums2(): Pair<Double, Double>? {
            val a = num(0) ?: return null
            val b = num(1) ?: return null
            return a to b
        }

        fun typeError(message: String? = null): SpValue {
            errors.add(
                ExprError(ExprErrorCode.E_TYPE, message ?: "$name の引数の型が正しくありません")
            )
            return SpValue.Null
        }

        fun arity(expected: Int, block: () -> SpValue): SpValue =
            if (args.size != expected) {
                errors.add(ExprError(ExprErrorCode.E_TYPE, "$name は引数を $expected 個取ります (${args.size} 個が渡されました)"))
                SpValue.Null
            } else block()

        fun arityRange(min: Int, max: Int, block: () -> SpValue): SpValue =
            if (args.size < min || args.size > max) {
                errors.add(ExprError(ExprErrorCode.E_TYPE, "$name は引数を $min〜$max 個取ります (${args.size} 個が渡されました)"))
                SpValue.Null
            } else block()

        fun atLeast(min: Int, block: () -> SpValue): SpValue =
            if (args.size < min) {
                errors.add(ExprError(ExprErrorCode.E_TYPE, "$name は引数を $min 個以上取ります"))
                SpValue.Null
            } else block()
    }
}
