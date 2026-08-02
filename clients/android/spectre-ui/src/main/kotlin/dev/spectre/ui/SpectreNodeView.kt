package dev.spectre.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import dev.spectre.core.PLACEHOLDER_NODE_TYPE
import dev.spectre.core.RenderNode
import dev.spectre.ui.components.BadgeView
import dev.spectre.ui.components.ButtonView
import dev.spectre.ui.components.CardView
import dev.spectre.ui.components.CheckboxView
import dev.spectre.ui.components.DatePickerView
import dev.spectre.ui.components.DividerView
import dev.spectre.ui.components.GridView
import dev.spectre.ui.components.HStackView
import dev.spectre.ui.components.IconView
import dev.spectre.ui.components.ImageView
import dev.spectre.ui.components.ListView
import dev.spectre.ui.components.ProgressIndicatorView
import dev.spectre.ui.components.RadioGroupView
import dev.spectre.ui.components.ScrollViewView
import dev.spectre.ui.components.SectionView
import dev.spectre.ui.components.SelectView
import dev.spectre.ui.components.SliderView
import dev.spectre.ui.components.SpacerView
import dev.spectre.ui.components.StepperView
import dev.spectre.ui.components.TabsView
import dev.spectre.ui.components.TextFieldView
import dev.spectre.ui.components.TextView
import dev.spectre.ui.components.ToggleView
import dev.spectre.ui.components.UnsupportedComponentView
import dev.spectre.ui.components.VStackView
import dev.spectre.ui.components.ZStackView

val LocalSpectreController = staticCompositionLocalOf<SpectreScreenController> {
    error("SpectreScreenController がありません。SpectreScreen の内側で使ってください")
}

/**
 * スクロールする親の内側にいるか。
 *
 * Compose では高さが無限になる親の中に LazyColumn を置くと実行時に落ちるため、
 * List / Grid はこのフラグを見て遅延描画と通常描画を切り替える。
 * 「入れ子の縦スクロールは書けてしまうが壊れる」という Compose の制約を
 * ドキュメント作者に押し付けないための処置。
 */
internal val LocalInScrollableParent = staticCompositionLocalOf { false }

/**
 * 解決済みノードを描画する。
 *
 * [RenderNode.type] は [Resolver] が対応済みであることを保証しているため、
 * ここに未知の型が来ることはない。それでも来た場合は何も描かない
 * (クラッシュしないことが不変条件)。
 */
@Composable
fun SpectreNodeView(node: RenderNode, modifier: Modifier = Modifier) {
    when (node.type) {
        // レイアウト
        "VStack" -> VStackView(node, modifier)
        "HStack" -> HStackView(node, modifier)
        "ZStack" -> ZStackView(node, modifier)
        "Spacer" -> SpacerView(node, modifier)
        "Divider" -> DividerView(node, modifier)
        "ScrollView" -> ScrollViewView(node, modifier)
        "List" -> ListView(node, modifier)
        "Grid" -> GridView(node, modifier)
        "Card" -> CardView(node, modifier)
        "Section" -> SectionView(node, modifier)
        "Tabs" -> TabsView(node, modifier)

        // コンテンツ
        "Text" -> TextView(node, modifier)
        "Image" -> ImageView(node, modifier)
        "Icon" -> IconView(node, modifier)
        "Badge" -> BadgeView(node, modifier)
        "ProgressIndicator" -> ProgressIndicatorView(node, modifier)

        // 入力
        "Button" -> ButtonView(node, modifier)
        "TextField" -> TextFieldView(node, modifier)
        "Toggle" -> ToggleView(node, modifier)
        "Checkbox" -> CheckboxView(node, modifier)
        "RadioGroup" -> RadioGroupView(node, modifier)
        "Select" -> SelectView(node, modifier)
        "Slider" -> SliderView(node, modifier)
        "Stepper" -> StepperView(node, modifier)
        "DatePicker" -> DatePickerView(node, modifier)

        // 未対応コンポーネントの劣化の最終手段 (docs/compatibility.md §3, ADR-0006)。
        // Resolver が fallback も optional もない未知ノードをここに置き換えて渡す。
        PLACEHOLDER_NODE_TYPE -> UnsupportedComponentView(node, modifier)

        // Screen はルート専用。SpectreScreen が直接処理するのでここには来ない。
        else -> Unit
    }
}

/** 子ノードをスクロール文脈つきで描画する。 */
@Composable
internal fun ProvideScrollableParent(value: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalInScrollableParent provides value, content = content)
}
