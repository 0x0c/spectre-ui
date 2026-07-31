package dev.spectre.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import dev.spectre.core.RenderNode
import dev.spectre.core.SpValue
import dev.spectre.core.asStringOrNull
import dev.spectre.ui.LocalInScrollableParent
import dev.spectre.ui.LocalSpectreController
import dev.spectre.ui.LocalSpectreTheme
import dev.spectre.ui.ProvideScrollableParent
import dev.spectre.ui.SpectreNodeView
import dev.spectre.ui.boxAlignmentOf
import dev.spectre.ui.bool
import dev.spectre.ui.horizontalAlignmentOf
import dev.spectre.ui.int
import dev.spectre.ui.spectreColumnChild
import dev.spectre.ui.spectreNode
import dev.spectre.ui.spectreRowChild
import dev.spectre.ui.stringOrNull
import dev.spectre.ui.tabItems
import dev.spectre.ui.token
import dev.spectre.ui.verticalAlignmentOf

@Composable
fun VStackView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val spacing = theme.space(node.token("spacing", "none"))
    val arrangement = when (node.token("distribution", "packed")) {
        "spaceBetween" -> Arrangement.SpaceBetween
        "spaceAround" -> Arrangement.SpaceAround
        else -> Arrangement.spacedBy(spacing)
    }
    Column(
        modifier = modifier.spectreNode(node),
        verticalArrangement = arrangement,
        horizontalAlignment = horizontalAlignmentOf(node.token("alignment", "leading")),
    ) {
        node.children.forEach { child ->
            SpectreNodeView(child, Modifier.spectreColumnChild(this, child))
        }
    }
}

@Composable
fun HStackView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val spacing = theme.space(node.token("spacing", "none"))
    val arrangement = when (node.token("distribution", "packed")) {
        "spaceBetween" -> Arrangement.SpaceBetween
        "spaceAround" -> Arrangement.SpaceAround
        else -> Arrangement.spacedBy(spacing)
    }
    // wrap: true は v0.1 では通常の Row にフォールバックする。
    // FlowRow は実験的 API で、対応する SwiftUI 側の挙動も揃えにくいため。
    Row(
        modifier = modifier.spectreNode(node),
        horizontalArrangement = arrangement,
        verticalAlignment = verticalAlignmentOf(node.token("alignment", "center")),
    ) {
        node.children.forEach { child ->
            SpectreNodeView(child, Modifier.spectreRowChild(this, child))
        }
    }
}

@Composable
fun ZStackView(node: RenderNode, modifier: Modifier) {
    Box(
        modifier = modifier.spectreNode(node),
        contentAlignment = boxAlignmentOf(node.token("alignment", "center")),
    ) {
        node.children.forEach { child -> SpectreNodeView(child) }
    }
}

@Composable
fun SpacerView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val minLength = node.stringOrNull("minLength")
    if (minLength != null) {
        Spacer(modifier.size(theme.space(minLength)))
    } else {
        Spacer(modifier)
    }
}

@Composable
fun DividerView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val color = theme.color(node.token("color", "outlineVariant"), MaterialTheme.colorScheme.outlineVariant)
    val inset = theme.space(node.token("inset", "none"))
    if (node.token("orientation", "horizontal") == "vertical") {
        VerticalDivider(modifier = modifier.padding(vertical = inset), color = color)
    } else {
        HorizontalDivider(modifier = modifier.padding(horizontal = inset), color = color)
    }
}

@Composable
fun ScrollViewView(node: RenderNode, modifier: Modifier) {
    val state = rememberScrollState()
    val horizontal = node.token("direction", "vertical") == "horizontal"
    val scrolled = if (horizontal) {
        modifier.spectreNode(node).horizontalScroll(state)
    } else {
        modifier.spectreNode(node).verticalScroll(state)
    }
    Box(scrolled) {
        // 縦スクロールの内側では List/Grid を遅延描画にできない
        ProvideScrollableParent(!horizontal) {
            node.children.forEach { child -> SpectreNodeView(child) }
        }
    }
}

/**
 * 縦方向のコレクション。
 *
 * スクロールする親の内側では通常の [Column] として描画する。Compose は
 * 高さが無限に与えられた親の中の LazyColumn を実行時例外にするため、
 * ここで切り替えないと「スクロールする画面にリストを置いたら落ちる」ことになる。
 */
@Composable
fun ListView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val spacing = theme.space(node.token("spacing", "none"))
    val separator = node.bool("separator", false)
    val header = node.node("header")
    val footer = node.node("footer")

    if (LocalInScrollableParent.current) {
        Column(
            modifier = modifier.spectreNode(node),
            verticalArrangement = Arrangement.spacedBy(spacing),
        ) {
            header?.let { SpectreNodeView(it) }
            node.children.forEachIndexed { index, child ->
                SpectreNodeView(child, Modifier.spectreColumnChild(this, child))
                if (separator && index != node.children.lastIndex) HorizontalDivider()
            }
            footer?.let { SpectreNodeView(it) }
        }
    } else {
        LazyColumn(
            modifier = modifier.spectreNode(node),
            verticalArrangement = Arrangement.spacedBy(spacing),
        ) {
            header?.let { item { SpectreNodeView(it) } }
            itemsIndexedStable(node.children) { index, child ->
                SpectreNodeView(child)
                if (separator && index != node.children.lastIndex) HorizontalDivider()
            }
            footer?.let { item { SpectreNodeView(it) } }
        }
    }
}

/**
 * repeat が付けた安定キーを LazyColumn の key に渡す。
 * キーがないノードは位置をキーにするため、並び替え時に再生成される。
 */
private fun androidx.compose.foundation.lazy.LazyListScope.itemsIndexedStable(
    nodes: List<RenderNode>,
    content: @Composable (Int, RenderNode) -> Unit,
) {
    items(
        count = nodes.size,
        key = { index -> nodes[index].key ?: "${nodes[index].id ?: nodes[index].type}#$index" },
    ) { index -> content(index, nodes[index]) }
}

@Composable
fun GridView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val spacing = theme.space(node.token("spacing", "sm"))
    val columnsValue = node.props["columns"]
    val columns = when (columnsValue) {
        is SpValue.Num -> columnsValue.value.toInt().coerceIn(1, 4)
        else -> 2
    }

    if (LocalInScrollableParent.current) {
        // 遅延描画できない文脈では、行に分割して通常の Column/Row で組む。
        Column(
            modifier = modifier.spectreNode(node),
            verticalArrangement = Arrangement.spacedBy(spacing),
        ) {
            node.children.chunked(columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(spacing)) {
                    row.forEach { child ->
                        SpectreNodeView(child, Modifier.weight(1f))
                    }
                    // 最終行が埋まらない場合に幅を揃える
                    repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            modifier = modifier.spectreNode(node),
            verticalArrangement = Arrangement.spacedBy(spacing),
            horizontalArrangement = Arrangement.spacedBy(spacing),
        ) {
            items(
                count = node.children.size,
                key = { index -> node.children[index].key ?: index },
            ) { index -> SpectreNodeView(node.children[index]) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val controller = LocalSpectreController.current
    val onTap = node.actions("onTap")
    val elevation = node.int("elevation", 1).coerceIn(0, 3)
    val shape = RoundedCornerShape(theme.corner(node.token("radius", "md")))
    val padding = theme.space(node.token("padding", "md"))

    val content: @Composable () -> Unit = {
        Column(Modifier.padding(padding)) {
            node.children.forEach { child ->
                SpectreNodeView(child, Modifier.spectreColumnChild(this, child))
            }
        }
    }

    if (onTap.isEmpty()) {
        Card(
            modifier = modifier.spectreNode(node),
            shape = shape,
            elevation = CardDefaults.cardElevation(defaultElevation = (elevation * 2).dp),
        ) { content() }
    } else {
        Card(
            onClick = { controller.dispatch(onTap) },
            modifier = modifier.spectreNode(node),
            shape = shape,
            elevation = CardDefaults.cardElevation(defaultElevation = (elevation * 2).dp),
        ) { content() }
    }
}

@Composable
fun SectionView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val controller = LocalSpectreController.current
    val title = node.stringOrNull("title")
    val subtitle = node.stringOrNull("subtitle")
    val action = node.props["action"] as? SpValue.Obj
    val actionLabel = action?.entries?.get("label")?.asStringOrNull
    val actionActions = node.actions("action.actions")

    Column(
        modifier = modifier.spectreNode(node),
        verticalArrangement = Arrangement.spacedBy(theme.space("sm")),
    ) {
        if (title != null || actionLabel != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    title?.let {
                        Text(it, style = theme.textStyle("titleSm", MaterialTheme.typography.titleMedium))
                    }
                    subtitle?.let {
                        Text(
                            it,
                            style = theme.textStyle("bodySm", MaterialTheme.typography.bodySmall),
                            color = theme.color("onSurfaceVariant", MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                    }
                }
                if (actionLabel != null) {
                    TextButton(onClick = { controller.dispatch(actionActions) }) { Text(actionLabel) }
                }
            }
        }
        node.children.forEach { child ->
            SpectreNodeView(child, Modifier.spectreColumnChild(this, child))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TabsView(node: RenderNode, modifier: Modifier) {
    val controller = LocalSpectreController.current
    val items = node.tabItems()
    if (items.isEmpty()) return

    val bindTo = node.stringOrNull("bindTo")
    val selectedId = bindTo?.let { controller.stateValue(it).asStringOrNull }
    val selectedIndex = items.indexOfFirst { it.id == selectedId }.takeIf { it >= 0 } ?: 0

    Column(modifier.spectreNode(node)) {
        TabRow(selectedTabIndex = selectedIndex) {
            items.forEachIndexed { index, item ->
                Tab(
                    selected = index == selectedIndex,
                    onClick = {
                        bindTo?.let { controller.setStateValue(it, SpValue.Str(item.id)) }
                        controller.dispatch(node.actions("onChange"))
                    },
                    text = { Text(item.label) },
                )
            }
        }
        // children[i] が items[i] の内容に対応する
        node.children.getOrNull(selectedIndex)?.let { SpectreNodeView(it) }
    }
}
