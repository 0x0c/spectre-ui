package dev.spectre.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.spectre.core.RenderNode
import dev.spectre.core.SpValue
import dev.spectre.core.asDoubleOrNull
import dev.spectre.core.asStringOrNull

/**
 * ノードの `layout` / `style` を Compose の [Modifier] に写す。
 *
 * 絶対座標指定は仕様上存在しない。表現できるのは padding / margin / サイズ /
 * weight / 交差軸の配置だけで、これは画面サイズとフォントスケールの差異に
 * 耐えるための意図的な制約 (docs/spec/schema.md §2.1)。
 */
@Composable
internal fun Modifier.spectreLayout(node: RenderNode): Modifier {
    val theme = LocalSpectreTheme.current
    var modifier = this

    // margin は外側 -> 先に適用する
    edgeInsets(node.layout["margin"], theme)?.let { modifier = modifier.padding(it) }

    when (val width = node.layout["width"]) {
        is SpValue.Str -> if (width.value == "fill") modifier = modifier.fillMaxWidth()
        is SpValue.Num -> modifier = modifier.width(width.value.dp)
        else -> Unit
    }
    when (val height = node.layout["height"]) {
        is SpValue.Str -> if (height.value == "fill") modifier = modifier.fillMaxHeight()
        is SpValue.Num -> modifier = modifier.height(height.value.dp)
        else -> Unit
    }
    node.layout["aspectRatio"]?.asDoubleOrNull?.let {
        if (it > 0) modifier = modifier.aspectRatio(it.toFloat())
    }

    return modifier
}

/**
 * `style` を Modifier に写す。
 *
 * 角丸を背景・枠線より先に clip したいので、background より前に shape を決める。
 */
@Composable
internal fun Modifier.spectreStyle(node: RenderNode): Modifier {
    val theme = LocalSpectreTheme.current
    var modifier = this

    node.style["opacity"]?.asDoubleOrNull?.let { modifier = modifier.alpha(it.toFloat()) }

    val radius = node.style["radius"]?.asStringOrNull
    val shape = RoundedCornerShape(theme.corner(radius))
    if (radius != null && radius != "none") modifier = modifier.clip(shape)

    node.style["background"]?.asStringOrNull?.let { token ->
        val color = theme.colors[token]
        if (color != null) modifier = modifier.background(color, shape)
    }

    (node.style["border"] as? SpValue.Obj)?.let { border ->
        val color = border.entries["color"]?.asStringOrNull?.let { theme.colors[it] } ?: Color.Unspecified
        val width = border.entries["width"]?.asDoubleOrNull ?: 1.0
        if (color != Color.Unspecified) {
            modifier = modifier.border(width.dp, color, shape)
        }
    }

    // padding は内側 -> 背景を塗ったあとに適用する
    edgeInsets(node.layout["padding"], theme)?.let { modifier = modifier.padding(it) }

    return modifier
}

/** layout と style をまとめて適用する。順序が意味を持つのでこの関数経由で使う。 */
@Composable
internal fun Modifier.spectreNode(node: RenderNode): Modifier =
    this.spectreLayout(node).spectreStyle(node).spectreScrollTarget(node)

/**
 * `scrollTo` アクション (docs/spec/actions.md) の着地点。id を持つノードすべてに
 * 適用しておき、コントローラの [dev.spectre.ui.SpectreScreenController.scrollRequest]
 * が自分の id を指した時点でスクロールして知らせる。
 */
@Composable
internal fun Modifier.spectreScrollTarget(node: RenderNode): Modifier {
    val nodeId = node.id ?: return this
    val controller = LocalSpectreController.current
    val requester = remember(nodeId) { BringIntoViewRequester() }
    val request = controller.scrollRequest
    LaunchedEffect(request) {
        if (request != null && request.nodeId == nodeId) {
            requester.bringIntoView()
            controller.consumeScrollRequest()
        }
    }
    return this.bringIntoViewRequester(requester)
}

/**
 * `focus` アクションの着地点。フォーカスを受けられるコンポーネント (今のところ
 * [dev.spectre.ui.components.TextFieldView]) だけが使う — Card や Text に付けても
 * 意味がないため [spectreNode] には含めない。
 */
@Composable
internal fun Modifier.spectreFocusTarget(node: RenderNode): Modifier {
    val nodeId = node.id ?: return this
    val controller = LocalSpectreController.current
    val requester = remember(nodeId) { FocusRequester() }
    LaunchedEffect(controller.focusRequest) {
        if (controller.focusRequest == nodeId) {
            requester.requestFocus()
            controller.consumeFocusRequest()
        }
    }
    return this.focusRequester(requester)
}

/**
 * Stack の中でだけ意味を持つ `weight` / `alignSelf`。
 * スコープが必要なので Modifier 拡張とは別に用意する。
 */
internal fun Modifier.spectreColumnChild(scope: ColumnScope, node: RenderNode): Modifier = with(scope) {
    var modifier = this@spectreColumnChild
    node.layout["weight"]?.asDoubleOrNull?.let { if (it > 0) modifier = modifier.weight(it.toFloat()) }
    when (node.layout["alignSelf"]?.asStringOrNull) {
        "start" -> modifier = modifier.align(androidx.compose.ui.Alignment.Start)
        "center" -> modifier = modifier.align(androidx.compose.ui.Alignment.CenterHorizontally)
        "end" -> modifier = modifier.align(androidx.compose.ui.Alignment.End)
        "stretch" -> modifier = modifier.fillMaxWidth()
    }
    modifier
}

internal fun Modifier.spectreRowChild(scope: RowScope, node: RenderNode): Modifier = with(scope) {
    var modifier = this@spectreRowChild
    node.layout["weight"]?.asDoubleOrNull?.let { if (it > 0) modifier = modifier.weight(it.toFloat()) }
    when (node.layout["alignSelf"]?.asStringOrNull) {
        "start" -> modifier = modifier.align(androidx.compose.ui.Alignment.Top)
        "center" -> modifier = modifier.align(androidx.compose.ui.Alignment.CenterVertically)
        "end" -> modifier = modifier.align(androidx.compose.ui.Alignment.Bottom)
        "stretch" -> modifier = modifier.fillMaxHeight()
    }
    modifier
}

/**
 * SpacingToken 単体か `{top, leading, bottom, trailing}` のどちらかを受け取る。
 */
private fun edgeInsets(value: SpValue?, theme: SpectreTheme): PaddingValues? = when (value) {
    is SpValue.Str -> if (value.value == "none") null else PaddingValues(theme.space(value.value))
    is SpValue.Obj -> PaddingValues(
        start = theme.space(value.entries["leading"]?.asStringOrNull),
        top = theme.space(value.entries["top"]?.asStringOrNull),
        end = theme.space(value.entries["trailing"]?.asStringOrNull),
        bottom = theme.space(value.entries["bottom"]?.asStringOrNull),
    )
    else -> null
}
