package dev.spectre.ui

import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import dev.spectre.core.RenderNode
import dev.spectre.core.SpValue
import dev.spectre.core.asBoolOrNull
import dev.spectre.core.asDoubleOrNull
import dev.spectre.core.asIntOrNull
import dev.spectre.core.asListOrNull
import dev.spectre.core.asStringOrNull
import dev.spectre.core.isTruthy
import dev.spectre.core.stringify

/**
 * 解決済みノードからの型付き取り出し。
 *
 * 値が期待した型でない場合は既定値に落とす。ここで例外を投げると
 * 「壊れたドキュメントでアプリが落ちる」ことになるため、必ず値を返す。
 */

/**
 * 文字列プロパティ。
 *
 * 数値や真偽値が来ても文字列化する。`"${item}"` のように式が単独で書かれた場合は
 * 型が保存されて数値のまま解決されるため、文字列化はここが担当する
 * (docs/spec/expression.md §1)。
 */
fun RenderNode.string(name: String, default: String = ""): String {
    val value = props[name] ?: return default
    if (value is SpValue.Null) return default
    return value.stringify()
}

fun RenderNode.stringOrNull(name: String): String? {
    val value = props[name] ?: return null
    if (value is SpValue.Null) return null
    return value.stringify()
}

fun RenderNode.bool(name: String, default: Boolean): Boolean =
    props[name]?.let { if (it is SpValue.Null) default else it.isTruthy } ?: default

fun RenderNode.int(name: String, default: Int): Int =
    props[name]?.asIntOrNull ?: default

fun RenderNode.intOrNull(name: String): Int? = props[name]?.asIntOrNull

fun RenderNode.float(name: String, default: Float): Float =
    props[name]?.asDoubleOrNull?.toFloat() ?: default

fun RenderNode.floatOrNull(name: String): Float? = props[name]?.asDoubleOrNull?.toFloat()

fun RenderNode.token(name: String, default: String): String =
    props[name]?.asStringOrNull ?: default

fun RenderNode.tokenOrNull(name: String): String? = props[name]?.asStringOrNull

/** `{value, label, enabled}` の配列を取り出す。 */
fun RenderNode.options(name: String): List<SpectreOption> =
    props[name]?.asListOrNull.orEmpty().mapNotNull { item ->
        val obj = item as? SpValue.Obj ?: return@mapNotNull null
        val value = obj.entries["value"]?.stringify() ?: return@mapNotNull null
        SpectreOption(
            value = value,
            label = obj.entries["label"]?.stringify() ?: value,
            enabled = obj.entries["enabled"]?.isTruthy ?: true,
        )
    }

data class SpectreOption(val value: String, val label: String, val enabled: Boolean = true)

/** Tabs の `items`。 */
fun RenderNode.tabItems(): List<SpectreTabItem> =
    props["items"]?.asListOrNull.orEmpty().mapNotNull { item ->
        val obj = item as? SpValue.Obj ?: return@mapNotNull null
        val id = obj.entries["id"]?.stringify() ?: return@mapNotNull null
        SpectreTabItem(
            id = id,
            label = obj.entries["label"]?.stringify() ?: id,
            icon = obj.entries["icon"]?.asStringOrNull,
            badge = obj.entries["badge"]?.asStringOrNull,
        )
    }

data class SpectreTabItem(val id: String, val label: String, val icon: String?, val badge: String?)

/** a11y のラベル。装飾扱いのノードは null を返してスクリーンリーダから隠す。 */
fun RenderNode.a11yLabel(): String? {
    if (a11y["hidden"]?.isTruthy == true) return null
    return a11y["label"]?.let { if (it is SpValue.Null) null else it.stringify() }
}

fun RenderNode.a11yHidden(): Boolean = a11y["hidden"]?.isTruthy == true

// -- 列挙値の写像 -------------------------------------------------------------

internal fun textAlignOf(token: String): TextAlign = when (token) {
    "center" -> TextAlign.Center
    "end" -> TextAlign.End
    else -> TextAlign.Start
}

internal fun fontWeightOf(token: String): FontWeight? = when (token) {
    "medium" -> FontWeight.Medium
    "bold" -> FontWeight.Bold
    else -> null
}

internal fun textDecorationOf(token: String): TextDecoration? = when (token) {
    "underline" -> TextDecoration.Underline
    "strikethrough" -> TextDecoration.LineThrough
    else -> null
}

internal fun overflowOf(token: String): TextOverflow = when (token) {
    "middle" -> TextOverflow.Ellipsis // Compose に中央省略がないため末尾省略で代用する
    "none" -> TextOverflow.Clip
    else -> TextOverflow.Ellipsis
}

internal fun contentScaleOf(token: String): ContentScale = when (token) {
    "fit" -> ContentScale.Fit
    else -> ContentScale.Crop
}

internal fun horizontalAlignmentOf(token: String): Alignment.Horizontal = when (token) {
    "center" -> Alignment.CenterHorizontally
    "trailing" -> Alignment.End
    else -> Alignment.Start
}

internal fun verticalAlignmentOf(token: String): Alignment.Vertical = when (token) {
    "top" -> Alignment.Top
    "bottom" -> Alignment.Bottom
    else -> Alignment.CenterVertically
}

internal fun boxAlignmentOf(token: String): Alignment = when (token) {
    "topLeading" -> Alignment.TopStart
    "top" -> Alignment.TopCenter
    "topTrailing" -> Alignment.TopEnd
    "leading" -> Alignment.CenterStart
    "trailing" -> Alignment.CenterEnd
    "bottomLeading" -> Alignment.BottomStart
    "bottom" -> Alignment.BottomCenter
    "bottomTrailing" -> Alignment.BottomEnd
    else -> Alignment.Center
}
