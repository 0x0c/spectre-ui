package dev.spectre.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import dev.spectre.core.RenderNode
import dev.spectre.ui.LocalSpectreTheme
import dev.spectre.ui.a11yHidden
import dev.spectre.ui.a11yLabel
import dev.spectre.ui.bool
import dev.spectre.ui.contentScaleOf
import dev.spectre.ui.fontWeightOf
import dev.spectre.ui.floatOrNull
import dev.spectre.ui.intOrNull
import dev.spectre.ui.overflowOf
import dev.spectre.ui.spectreNode
import dev.spectre.ui.string
import dev.spectre.ui.textAlignOf
import dev.spectre.ui.textDecorationOf
import dev.spectre.ui.token

@Composable
fun TextView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val style = theme.textStyle(node.token("typography", "bodyMd"), MaterialTheme.typography.bodyMedium)
    Text(
        // 数値がそのまま来ることがある (単独の式は型が保存される) ので string() で文字列化する
        text = node.string("text"),
        modifier = modifier.spectreNode(node).applyA11y(node),
        style = style,
        color = theme.color(node.token("color", "onSurface"), MaterialTheme.colorScheme.onSurface),
        textAlign = textAlignOf(node.token("align", "start")),
        fontWeight = fontWeightOf(node.token("weight", "regular")),
        textDecoration = textDecorationOf(node.token("decoration", "none")),
        maxLines = node.intOrNull("maxLines") ?: Int.MAX_VALUE,
        overflow = overflowOf(node.token("truncation", "tail")),
    )
}

@Composable
fun ImageView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val decorative = node.bool("decorative", false)
    val radius = theme.corner(node.token("radius", "none"))
    val placeholderColor = theme.color("surfaceVariant", MaterialTheme.colorScheme.surfaceVariant)

    AsyncImage(
        model = node.string("url"),
        // 装飾画像はスクリーンリーダから隠す
        contentDescription = if (decorative) null else node.a11yLabel(),
        modifier = modifier
            .spectreNode(node)
            .clip(RoundedCornerShape(radius))
            .background(placeholderColor),
        contentScale = contentScaleOf(node.token("contentMode", "fill")),
    )
}

@Composable
fun IconView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val size = when (node.token("size", "md")) {
        "sm" -> 16.dp
        "lg" -> 32.dp
        else -> 24.dp
    }
    Icon(
        imageVector = theme.icon(node.token("name", "")),
        contentDescription = node.a11yLabel(),
        modifier = modifier.spectreNode(node).size(size),
        tint = theme.color(node.token("color", "onSurface"), MaterialTheme.colorScheme.onSurface),
    )
}

@Composable
fun BadgeView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val tone = node.token("tone", "neutral")
    val outlined = node.token("variant", "filled") == "outlined"

    val (container, content) = when (tone) {
        "info" -> theme.color("info", MaterialTheme.colorScheme.tertiary) to
            theme.color("onInfo", MaterialTheme.colorScheme.onTertiary)
        "success" -> theme.color("success", MaterialTheme.colorScheme.primary) to
            theme.color("onSuccess", Color.White)
        "warning" -> theme.color("warning", MaterialTheme.colorScheme.secondary) to
            theme.color("onWarning", Color.Black)
        "error" -> theme.color("error", MaterialTheme.colorScheme.error) to
            theme.color("onError", MaterialTheme.colorScheme.onError)
        else -> theme.color("surfaceVariant", MaterialTheme.colorScheme.surfaceVariant) to
            theme.color("onSurfaceVariant", MaterialTheme.colorScheme.onSurfaceVariant)
    }

    val shape = RoundedCornerShape(theme.corner("sm"))
    val decorated = if (outlined) {
        modifier.spectreNode(node).border(1.dp, container, shape)
    } else {
        modifier.spectreNode(node).background(container, shape)
    }

    Box(decorated.padding(horizontal = theme.space("sm"), vertical = 2.dp)) {
        Text(
            text = node.string("text"),
            style = theme.textStyle("caption", MaterialTheme.typography.labelSmall),
            color = if (outlined) container else content,
        )
    }
}

@Composable
fun ProgressIndicatorView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val value = node.floatOrNull("value")
    val size = when (node.token("size", "md")) {
        "sm" -> 16.dp
        "lg" -> 48.dp
        else -> 32.dp
    }
    val color = theme.color("primary", MaterialTheme.colorScheme.primary)
    val base = modifier.spectreNode(node)

    if (node.token("kind", "circular") == "linear") {
        if (value != null) {
            LinearProgressIndicator(progress = { value.coerceIn(0f, 1f) }, modifier = base, color = color)
        } else {
            LinearProgressIndicator(modifier = base, color = color)
        }
    } else {
        if (value != null) {
            CircularProgressIndicator(
                progress = { value.coerceIn(0f, 1f) },
                modifier = base.size(size),
                color = color,
            )
        } else {
            CircularProgressIndicator(modifier = base.size(size), color = color)
        }
    }
}

/**
 * 未対応コンポーネントの劣化の最終手段 (docs/compatibility.md §3, ADR-0006)。
 *
 * [dev.spectre.core.PLACEHOLDER_NODE_TYPE] に対して描く汎用プレースホルダ。省略と違って
 * 画面上に痕跡を残すことで、「何かが表示されないまま失われた」ことを利用者・ホストアプリの
 * どちらから見ても分かるようにする。`componentType` prop に元の未知の型名を積んでいる
 * ([dev.spectre.core.Resolver] 参照)。
 */
@Composable
fun UnsupportedComponentView(node: RenderNode, modifier: Modifier = Modifier) {
    val theme = LocalSpectreTheme.current
    val outline = theme.color("outline", MaterialTheme.colorScheme.outline)
    val label = node.a11yLabel() ?: "表示できないコンテンツです (${node.string("componentType", "unknown")})"

    Box(
        modifier = modifier
            .spectreNode(node)
            .defaultMinSize(minWidth = 32.dp, minHeight = 32.dp)
            .border(1.dp, outline, RoundedCornerShape(theme.corner("sm")))
            .padding(theme.space("sm"))
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = theme.icon("warning"),
            contentDescription = null,
            tint = outline,
        )
    }
}

/**
 * a11y のラベル/非表示を Compose のセマンティクスに反映する。
 *
 * アイコンのみのボタンや装飾画像でラベルが欠けているケースはエディタ側の
 * リントで公開前に弾く前提だが、SDK 側でも受け取った指定は必ず反映する。
 */
internal fun Modifier.applyA11y(node: RenderNode): Modifier {
    if (node.a11yHidden()) return this.clearAndSetSemantics { }
    val label = node.a11yLabel() ?: return this
    return this.semantics { contentDescription = label }
}
