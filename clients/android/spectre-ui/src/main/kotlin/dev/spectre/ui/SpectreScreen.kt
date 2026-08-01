package dev.spectre.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import dev.spectre.core.Document
import dev.spectre.core.OverlayKind
import dev.spectre.core.RenderNode
import dev.spectre.core.RenderOverlay
import dev.spectre.core.SpValue
import dev.spectre.core.SpectreHostDelegate
import dev.spectre.core.asStringOrNull
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OverlayView(controller: SpectreScreenController, overlay: RenderOverlay) {
    when (overlay.kind) {
        OverlayKind.SHEET -> {
            val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
            ModalBottomSheet(
                onDismissRequest = { controller.dismissOverlay(overlay.id) },
                sheetState = sheetState,
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    overlay.props["title"]?.asStringOrNull?.let {
                        Text(it, style = MaterialTheme.typography.titleMedium)
                    }
                    overlay.root?.let { SpectreNodeView(it) }
                }
            }
        }

        OverlayKind.ALERT -> {
            // ボタンは role で振り分ける。cancel が dismissButton、それ以外が confirmButton。
            val confirm = overlay.buttons.firstOrNull { it.role != "cancel" }
            val cancel = overlay.buttons.firstOrNull { it.role == "cancel" }
            AlertDialog(
                onDismissRequest = { controller.dismissOverlay(overlay.id) },
                title = overlay.props["title"]?.asStringOrNull?.let { { Text(it) } },
                text = overlay.props["message"]?.asStringOrNull?.let { { Text(it) } },
                confirmButton = {
                    confirm?.let { button ->
                        TextButton(onClick = {
                            controller.dismissOverlay(overlay.id)
                            controller.dispatch(button.actions)
                        }) { Text(button.label) }
                    }
                },
                dismissButton = {
                    cancel?.let { button ->
                        TextButton(onClick = {
                            controller.dismissOverlay(overlay.id)
                            controller.dispatch(button.actions)
                        }) { Text(button.label) }
                    }
                },
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
