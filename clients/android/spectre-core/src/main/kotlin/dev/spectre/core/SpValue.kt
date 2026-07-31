package dev.spectre.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

/**
 * ドキュメント・状態・式評価で扱う値の統一表現。
 *
 * JSON の値域と 1:1 に対応するが、数値は常に [Double] として保持する。
 * これは iOS 実装 (`SpValue.number(Double)`) と揃えるためで、整数/浮動小数の
 * 区別によるプラットフォーム差を持ち込まないための意図的な選択。
 */
sealed interface SpValue {
    data object Null : SpValue
    data class Bool(val value: Boolean) : SpValue
    data class Num(val value: Double) : SpValue
    data class Str(val value: String) : SpValue
    data class Arr(val items: List<SpValue>) : SpValue
    data class Obj(val entries: Map<String, SpValue>) : SpValue

    companion object {
        val EmptyObj = Obj(emptyMap())

        fun of(value: Boolean): SpValue = Bool(value)
        fun of(value: Double): SpValue = Num(value)
        fun of(value: Int): SpValue = Num(value.toDouble())
        fun of(value: String): SpValue = Str(value)
        fun of(values: List<SpValue>): SpValue = Arr(values)
        fun of(entries: Map<String, SpValue>): SpValue = Obj(entries)
    }
}

// ---------------------------------------------------------------------------
// 真偽判定 (docs/spec/expression.md §3)
// ---------------------------------------------------------------------------

val SpValue.isTruthy: Boolean
    get() = when (this) {
        is SpValue.Null -> false
        is SpValue.Bool -> value
        is SpValue.Num -> value != 0.0 && !value.isNaN()
        is SpValue.Str -> value.isNotEmpty()
        is SpValue.Arr -> items.isNotEmpty()
        is SpValue.Obj -> entries.isNotEmpty()
    }

/** `default()` が代替値に差し替える「空」の判定。null と空文字/空配列/空オブジェクトが対象。 */
val SpValue.isBlank: Boolean
    get() = when (this) {
        is SpValue.Null -> true
        is SpValue.Str -> value.isEmpty()
        is SpValue.Arr -> items.isEmpty()
        is SpValue.Obj -> entries.isEmpty()
        else -> false
    }

// ---------------------------------------------------------------------------
// 文字列化 (docs/spec/expression.md §1)
// ---------------------------------------------------------------------------

/**
 * 文字列補間で使う表現。
 *
 * null が空文字になるのは UI 表示のため。`"在庫: ${data.stock}"` で
 * stock が欠けているときに `"在庫: null"` と出るより空のほうが害が小さい。
 */
fun SpValue.stringify(): String = when (this) {
    is SpValue.Null -> ""
    is SpValue.Bool -> if (value) "true" else "false"
    is SpValue.Num -> formatNumberPlain(value)
    is SpValue.Str -> value
    is SpValue.Arr -> items.joinToString(",", "[", "]") { it.toJsonLikeString() }
    // キーは辞書順に固定する。Swift の Dictionary は順序を持たないため、
    // 挿入順に依存すると iOS と Android で出力が食い違う。
    is SpValue.Obj -> entries.keys.sorted().joinToString(",", "{", "}") { k ->
        "${quoteJson(k)}:${entries.getValue(k).toJsonLikeString()}"
    }
}

private fun SpValue.toJsonLikeString(): String = when (this) {
    is SpValue.Null -> "null"
    is SpValue.Str -> quoteJson(value)
    else -> stringify()
}

private fun quoteJson(s: String): String = buildString {
    append('"')
    for (c in s) when (c) {
        '"' -> append("\\\"")
        '\\' -> append("\\\\")
        '\n' -> append("\\n")
        '\r' -> append("\\r")
        '\t' -> append("\\t")
        else -> append(c)
    }
    append('"')
}

/** ロケール非依存の素の数値表記。整数値は小数部を落とす (1280.0 -> "1280")。 */
internal fun formatNumberPlain(d: Double): String {
    if (d.isNaN()) return "NaN"
    if (d.isInfinite()) return if (d > 0) "Infinity" else "-Infinity"
    if (d == 0.0) return "0"
    if (isWholeNumber(d)) return d.toLong().toString()
    val s = d.toString()
    return if (s.endsWith(".0")) s.dropLast(2) else s
}

internal fun isWholeNumber(d: Double): Boolean =
    !d.isNaN() && !d.isInfinite() && d == Math.floor(d) && Math.abs(d) < 1e15

// ---------------------------------------------------------------------------
// JSON 相互変換
// ---------------------------------------------------------------------------

fun JsonElement.toSpValue(): SpValue = when (this) {
    is JsonNull -> SpValue.Null
    is JsonPrimitive -> when {
        isString -> SpValue.Str(content)
        content == "null" -> SpValue.Null
        else -> booleanOrNull?.let { SpValue.Bool(it) }
            ?: doubleOrNull?.let { SpValue.Num(it) }
            ?: SpValue.Str(content)
    }
    is JsonArray -> SpValue.Arr(map { it.toSpValue() })
    is JsonObject -> SpValue.Obj(entries.associate { (k, v) -> k to v.toSpValue() })
}

fun SpValue.toJsonElement(): JsonElement = when (this) {
    is SpValue.Null -> JsonNull
    is SpValue.Bool -> JsonPrimitive(value)
    is SpValue.Num -> if (isWholeNumber(value)) JsonPrimitive(value.toLong()) else JsonPrimitive(value)
    is SpValue.Str -> JsonPrimitive(value)
    is SpValue.Arr -> JsonArray(items.map { it.toJsonElement() })
    is SpValue.Obj -> JsonObject(entries.mapValues { it.value.toJsonElement() })
}

// ---------------------------------------------------------------------------
// アクセサ (レンダラから使う型付きヘルパ)
// ---------------------------------------------------------------------------

val SpValue.asStringOrNull: String? get() = (this as? SpValue.Str)?.value
val SpValue.asDoubleOrNull: Double? get() = (this as? SpValue.Num)?.value
val SpValue.asIntOrNull: Int? get() = (this as? SpValue.Num)?.value?.toInt()
val SpValue.asBoolOrNull: Boolean? get() = (this as? SpValue.Bool)?.value
val SpValue.asListOrNull: List<SpValue>? get() = (this as? SpValue.Arr)?.items
val SpValue.asMapOrNull: Map<String, SpValue>? get() = (this as? SpValue.Obj)?.entries

/** ドット区切りのパスで値を辿る。存在しなければ [SpValue.Null]。 */
fun SpValue.path(path: String): SpValue {
    if (path.isEmpty()) return this
    var current: SpValue = this
    for (segment in path.split('.')) {
        current = when (val c = current) {
            is SpValue.Obj -> c.entries[segment] ?: return SpValue.Null
            is SpValue.Arr -> segment.toIntOrNull()
                ?.let { idx -> c.items.getOrNull(idx) }
                ?: return SpValue.Null
            else -> return SpValue.Null
        }
    }
    return current
}

/**
 * ドット区切りのパスに値を書き込んだコピーを返す。
 * 途中のオブジェクトは存在しなければ作成される (`form.email` -> `{form:{email:...}}`)。
 */
fun SpValue.Obj.settingPath(path: String, value: SpValue): SpValue.Obj {
    val segments = path.split('.').filter { it.isNotEmpty() }
    if (segments.isEmpty()) return this
    return setRecursive(this, segments, 0, value)
}

private fun setRecursive(
    target: SpValue.Obj,
    segments: List<String>,
    index: Int,
    value: SpValue,
): SpValue.Obj {
    val key = segments[index]
    if (index == segments.lastIndex) {
        return SpValue.Obj(target.entries + (key to value))
    }
    val child = target.entries[key] as? SpValue.Obj ?: SpValue.EmptyObj
    return SpValue.Obj(target.entries + (key to setRecursive(child, segments, index + 1, value)))
}

/** 浅いマージ。サーバ応答の `state` / `data` をローカルに反映するときに使う。 */
fun SpValue.Obj.mergedWith(other: SpValue.Obj): SpValue.Obj =
    SpValue.Obj(entries + other.entries)
