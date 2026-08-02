package dev.spectre.ui

import android.view.WindowManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import dev.spectre.core.Document
import dev.spectre.core.OverlayKind
import dev.spectre.core.RenderNode
import dev.spectre.core.RenderOverlay
import dev.spectre.core.SpValue
import dev.spectre.core.SpectreHostDelegate
import dev.spectre.core.asStringOrNull
import dev.spectre.core.isTruthy
import kotlinx.coroutines.CoroutineScope

/**
 * ドキュメント1つを描画する公開エントリポイント。
 *
 * ホストアプリから見える API はこれと [SpectreHostDelegate] だけ。
 */
@Composable
fun SpectreScreen(
    document: Document,
    host: SpectreHostDelegate,
    modifier: Modifier = Modifier,
    env: SpValue.Obj = rememberSpectreEnv(),
    theme: SpectreTheme = spectreThemeFromMaterial(),
    onBack: (() -> Unit)? = null,
) {
    val coroutineScope: CoroutineScope = rememberCoroutineScope()
    val controller = remember(host) { SpectreScreenController(host, env, coroutineScope) }

    LaunchedEffect(document) {
        controller.onBack = onBack
        controller.load(document)
    }

    val render = controller.render ?: return

    CompositionLocalProvider(
        LocalSpectreController provides controller,
        LocalSpectreTheme provides theme,
    ) {
        render.root?.let { ScreenView(it, modifier) }
        SpectreOverlayHost(controller, render.overlays)
    }
}

/**
 * Screen ノードの描画。ルート専用なので [SpectreNodeView] の分岐には含めない。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScreenView(node: RenderNode, modifier: Modifier) {
    val theme = LocalSpectreTheme.current
    val scrollable = node.bool("scrollable", true)
    val background = theme.color(node.token("background", "background"), MaterialTheme.colorScheme.background)

    val appBar = node.props["appBar"] as? SpValue.Obj
    val appBarTitle = appBar?.entries?.get("title")?.asStringOrNull
    val appBarActions = node.nodes("appBar.actions[]")
    val bottomBar = node.node("bottomBar")

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = background,
        topBar = {
            if (appBar != null) {
                TopAppBar(
                    title = { appBarTitle?.let { Text(it) } },
                    actions = { appBarActions.forEach { SpectreNodeView(it) } },
                )
            }
        },
        bottomBar = { bottomBar?.let { SpectreNodeView(it) } },
    ) { padding ->
        val contentModifier = if (scrollable) {
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())
        } else {
            Modifier.fillMaxSize().padding(padding)
        }
        Box(contentModifier) {
            // scrollable な Screen の内側では List/Grid を遅延描画にできない
            ProvideScrollableParent(scrollable) {
                node.children.forEach { child -> SpectreNodeView(child) }
            }
        }
    }
}

/**
 * シート・アラート・トーストの表示。
 *
 * これらを木の中に置かず画面レベルの状態として扱うのは、iOS と Android で
 * モーダル表示の仕組みが大きく異なるため (docs/spec/schema.md §3)。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SpectreOverlayHost(
    controller: SpectreScreenController,
    overlays: List<RenderOverlay>,
) {
    overlays.filter { controller.visibleOverlays.contains(it.id) }.forEach { overlay ->
        // key で囲まないと、開いているオーバレイが入れ替わったときに
        // rememberModalBottomSheetState が前のシートの状態を引き継いでしまう。
        key(overlay.id) { OverlayView(controller, overlay) }
    }

    controller.activeToast?.let { toast ->
        Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.BottomCenter) {
            Snackbar {
                Text(toast.props["message"]?.asStringOrNull ?: "")
            }
        }
    }
}

/**
 * オーバレイの見え方 (docs/spec/schema.md §3.1)。
 *
 * `kind` が中身の形を、`presentation` が見え方を決める。省略時の既定は、この仕様が
 * 入る前のクライアントが描いていたものと一致させる — 古いドキュメントの見え方を
 * 変えないための約束 (ADR-0006)。
 */
internal data class OverlayPresentation(
    val style: String,
    val dimBackground: Boolean,
    val dismissOnBackdrop: Boolean,
    val dragToDismiss: Boolean,
) {
    companion object {
        fun of(overlay: RenderOverlay): OverlayPresentation {
            val dismissible = overlay.props["dismissible"]?.isTruthy ?: true
            val block = (overlay.props["presentation"] as? SpValue.Obj)?.entries.orEmpty()
            return OverlayPresentation(
                style = block["style"]?.asStringOrNull ?: "sheet",
                dimBackground = block["dimBackground"]?.isTruthy ?: true,
                dismissOnBackdrop = block["dismissOnBackdrop"]?.isTruthy ?: dismissible,
                dragToDismiss = block["dragToDismiss"]?.isTruthy ?: dismissible,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OverlayView(controller: SpectreScreenController, overlay: RenderOverlay) {
    val presentation = OverlayPresentation.of(overlay)
    when (overlay.kind) {
        OverlayKind.SHEET -> when (presentation.style) {
            "fullScreen", "dialog" -> Dialog(
                onDismissRequest = { controller.dismissOverlay(overlay.id) },
                properties = DialogProperties(
                    dismissOnBackPress = presentation.dismissOnBackdrop,
                    dismissOnClickOutside = presentation.dismissOnBackdrop,
                    // 全画面ではプラットフォーム既定の幅指定を外し、サーフェスに画面を埋めさせる。
                    usePlatformDefaultWidth = presentation.style != "fullScreen",
                ),
            ) {
                // Compose の Dialog はスクリムの濃さを DialogProperties で指定できない。
                // dimBackground を反映するには、ダイアログのウィンドウ側を触るしかない。
                // Window.setDimAmount は API 26 なので、minSdk 24 のここでは使えない。
                // LayoutParams.dimAmount と FLAG_DIM_BEHIND は API 1 からある。
                val dialogWindow = (LocalView.current.parent as? DialogWindowProvider)?.window
                SideEffect {
                    dialogWindow?.let { window ->
                        val params = window.attributes
                        params.dimAmount = if (presentation.dimBackground) 0.6f else 0f
                        window.attributes = params
                        if (presentation.dimBackground) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
                        }
                    }
                }

                Surface(
                    modifier = if (presentation.style == "fullScreen") Modifier.fillMaxSize() else Modifier.fillMaxWidth(),
                    shape = if (presentation.style == "fullScreen") RectangleShape else MaterialTheme.shapes.extraLarge,
                    color = MaterialTheme.colorScheme.surface,
                ) {
                    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
                        overlay.props["title"]?.asStringOrNull?.let {
                            Text(it, style = MaterialTheme.typography.titleMedium)
                        }
                        overlay.root?.let { SpectreNodeView(it) }
                    }
                }
            }

            else -> {
                // ModalBottomSheet はスクリムのタップもドラッグも同じ経路
                // (Hidden への遷移 -> onDismissRequest) を通るため、2つを別々には
                // 制御できない。どちらのジェスチャで閉じるかは confirmValueChange
                // 1箇所で決め、onDismissRequest は必ず閉じる。ここで条件を付けると、
                // 画面外へ滑ったシートが visibleOverlays に残って戻せなくなる。
                val gestureDismissible = presentation.dragToDismiss || presentation.dismissOnBackdrop
                val sheetState = rememberModalBottomSheetState(
                    skipPartiallyExpanded = false,
                    confirmValueChange = { target -> target != SheetValue.Hidden || gestureDismissible },
                )
                ModalBottomSheet(
                    onDismissRequest = { controller.dismissOverlay(overlay.id) },
                    sheetState = sheetState,
                    scrimColor = if (presentation.dimBackground) BottomSheetDefaults.ScrimColor else Color.Transparent,
                    dragHandle = if (presentation.dragToDismiss) { { BottomSheetDefaults.DragHandle() } } else null,
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        overlay.props["title"]?.asStringOrNull?.let {
                            Text(it, style = MaterialTheme.typography.titleMedium)
                        }
                        overlay.root?.let { SpectreNodeView(it) }
                    }
                }
            }
        }

        OverlayKind.ALERT -> {
            // ボタンは role で振り分ける。cancel が dismissButton、それ以外が confirmButton。
            // 仕様は3つまで許すので、cancel 以外が複数あれば confirm 側に並べる
            // (先頭だけを描くと、3つ目が黙って消える)。
            val confirms = overlay.buttons.filter { it.role != "cancel" }
            val cancel = overlay.buttons.firstOrNull { it.role == "cancel" }
            val theme = LocalSpectreTheme.current
            val iconName = overlay.props["icon"]?.asStringOrNull
            val toneColor = when (overlay.props["tone"]?.asStringOrNull) {
                "success" -> theme.color("success", MaterialTheme.colorScheme.primary)
                "warning" -> theme.color("warning", MaterialTheme.colorScheme.secondary)
                "error" -> theme.color("error", MaterialTheme.colorScheme.error)
                else -> theme.color("onSurfaceVariant", MaterialTheme.colorScheme.onSurfaceVariant)
            }
            val confirmButton: @Composable () -> Unit = {
                confirms.forEach { button ->
                    TextButton(onClick = {
                        controller.dismissOverlay(overlay.id)
                        controller.dispatch(button.actions)
                    }) { Text(button.label) }
                }
            }
            val dismissButton: @Composable () -> Unit = {
                cancel?.let { button ->
                    TextButton(onClick = {
                        controller.dismissOverlay(overlay.id)
                        controller.dispatch(button.actions)
                    }) { Text(button.label) }
                }
            }
            AlertDialog(
                onDismissRequest = { if (presentation.dismissOnBackdrop) controller.dismissOverlay(overlay.id) },
                properties = DialogProperties(
                    dismissOnBackPress = presentation.dismissOnBackdrop,
                    dismissOnClickOutside = presentation.dismissOnBackdrop,
                ),
                icon = iconName?.let { { Icon(theme.icon(it), contentDescription = null, tint = toneColor) } },
                iconContentColor = toneColor,
                title = overlay.props["title"]?.asStringOrNull?.let { { Text(it) } },
                text = overlay.props["message"]?.asStringOrNull?.let { { Text(it) } },
                // buttonLayout: "vertical" は、2つのボタンを同じスロットへ縦に積むことで表す。
                // AlertDialog はボタン列を横に並べるため、スロットを分けたままでは縦にならない。
                confirmButton = if (overlay.props["buttonLayout"]?.asStringOrNull == "vertical") {
                    {
                        Column { confirmButton(); dismissButton() }
                    }
                } else {
                    confirmButton
                },
                dismissButton = if (overlay.props["buttonLayout"]?.asStringOrNull == "vertical") null else dismissButton,
            )
        }

        // トーストは visibleOverlays ではなく activeToast で管理する
        OverlayKind.TOAST -> Unit
    }
}

/** 端末環境を式から参照できる形にまとめる (`env.platform` など)。 */
@Composable
fun rememberSpectreEnv(
    appVersion: String = "0.0.0",
    theme: String? = null,
): SpValue.Obj {
    val configuration = LocalConfiguration.current
    val isDark = isSystemInDarkTheme()
    val locale = configuration.locales[0]
    val widthDp = configuration.screenWidthDp

    return SpValue.Obj(
        mapOf(
            "platform" to SpValue.Str("android"),
            "appVersion" to SpValue.Str(appVersion),
            "osVersion" to SpValue.Str(android.os.Build.VERSION.RELEASE ?: ""),
            "locale" to SpValue.Str(locale.toLanguageTag()),
            "timeZone" to SpValue.Str(java.util.TimeZone.getDefault().id),
            "theme" to SpValue.Str(theme ?: if (isDark) "dark" else "light"),
            "widthClass" to SpValue.Str(
                when {
                    widthDp < 600 -> "compact"
                    widthDp < 840 -> "regular"
                    else -> "expanded"
                }
            ),
            "fontScale" to SpValue.Num(configuration.fontScale.toDouble()),
            "isOnline" to SpValue.Bool(true),
        )
    )
}
