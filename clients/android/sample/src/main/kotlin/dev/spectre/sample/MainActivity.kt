package dev.spectre.sample

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.spectre.core.Document
import dev.spectre.core.DocumentLoadResult
import dev.spectre.core.DocumentLoader
import dev.spectre.core.DocumentSource
import dev.spectre.core.SpectreDocumentTransport
import dev.spectre.core.SpectreDocumentTransportResult
import dev.spectre.ui.SpectreScreen
import dev.spectre.ui.rememberSpectreEnv
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect

/**
 * サーバードリブン UI のサンプル。
 *
 * サーバを立てる代わりに [AssetDocumentTransport] が assets 以下の JSON をネットワーク
 * 応答のふりをして返す。それでも [DocumentLoader] は本物の配信経路と同じ形
 * (メモリ→ディスク→バンドルの3層キャッシュ + stale-while-revalidate) で動くので、
 * 画面を切り替えて戻す・オフラインを試すと挙動の違いが観察できる
 * (docs/architecture.md §2)。
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) { SampleApp() }
            }
        }
    }
}

private data class SampleScreen(val label: String, val screenId: String, val assetPath: String)

private val SAMPLE_SCREENS = listOf(
    SampleScreen("商品詳細", "product_detail", "screens/product-detail.json"),
    SampleScreen("通知設定", "settings_form", "screens/settings-form.json"),
)

/** サンプル用の DocumentTransport。実アプリではここが実際の HTTPS クライアントになる。 */
private class AssetDocumentTransport(private val context: Context) : SpectreDocumentTransport {
    override suspend fun fetch(
        screenId: String,
        params: Map<String, String>,
        ifNoneMatch: String?,
        capabilities: SpectreCapabilities,
    ): SpectreDocumentTransportResult {
        // 実アプリではここで `Spectre-Schema` / `Spectre-Components` ヘッダに
        // capabilities を載せる (docs/compatibility.md §2)。アセット読み込みには
        // 相手サーバがいないので、ここでは使わない。
        val screen = SAMPLE_SCREENS.firstOrNull { it.screenId == screenId }
            ?: return SpectreDocumentTransportResult.Failure("未知の screenId: $screenId")
        delay(600) // ネットワーク往復の体感を出すための待ち (SampleHostDelegate と揃える)
        val body = context.assets.open(screen.assetPath).bufferedReader().use { it.readText() }
        val etag = body.hashCode().toString()
        if (ifNoneMatch == etag) return SpectreDocumentTransportResult.NotModified
        return SpectreDocumentTransportResult.Fresh(body, etag, maxAgeSec = 60)
    }
}

private fun bundledDocument(context: Context, screenId: String): String? {
    val screen = SAMPLE_SCREENS.firstOrNull { it.screenId == screenId } ?: return null
    return context.assets.open(screen.assetPath).bufferedReader().use { it.readText() }
}

@Composable
private fun SampleApp() {
    val context = LocalContext.current
    var selected by remember { mutableStateOf(0) }
    var document by remember { mutableStateOf<Document?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var loadSource by remember { mutableStateOf<DocumentSource?>(null) }
    val eventLog = remember { mutableStateListOf<String>() }

    val host = remember { SampleHostDelegate(context) { line -> eventLog.add(0, line) } }
    val env = rememberSpectreEnv(appVersion = "1.0.0")

    // ディスク層はアプリのキャッシュディレクトリ配下。ホストアプリはここを完全に制御できる
    // (例: ログアウト時に消す、サイズ上限を設ける、など)。
    val loader = remember {
        DocumentLoader(
            transport = AssetDocumentTransport(context),
            cacheDir = File(context.cacheDir, "spectre-documents"),
            bundledProvider = { screenId -> bundledDocument(context, screenId) },
        )
    }

    LaunchedEffect(selected) {
        eventLog.clear()
        loadError = null
        loader.load(SAMPLE_SCREENS[selected].screenId).collect { result ->
            when (result) {
                is DocumentLoadResult.Loaded -> {
                    document = result.document
                    loadSource = result.source
                    loadError = null
                }
                is DocumentLoadResult.Failed -> loadError = result.message
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        // 画面切り替え。実アプリではサーバから screenId で引く部分。
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SAMPLE_SCREENS.forEachIndexed { index, screen ->
                FilterChip(
                    selected = index == selected,
                    onClick = { selected = index },
                    label = { Text(screen.label) },
                )
            }
        }
        loadSource?.let {
            Text(
                "読み込み元: $it",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
        }

        Box(Modifier.weight(1f)) {
            val doc = document
            when {
                loadError != null && doc == null -> ErrorPanel(loadError!!)
                doc != null -> SpectreScreen(document = doc, host = host, env = env)
                else -> Unit
            }
        }

        // ドキュメントから発火した副作用の可視化。
        // 「ボタンを押すと何が起きたか」がその場で見えると理解が早い。
        EventLogPanel(eventLog) { eventLog.clear() }
    }
}

@Composable
private fun ErrorPanel(message: String) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("ドキュメントを読み込めませんでした", style = MaterialTheme.typography.titleMedium)
        Text(message, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun EventLogPanel(lines: List<String>, onClear: () -> Unit) {
    Surface(tonalElevation = 3.dp) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("イベントログ (${lines.size})", style = MaterialTheme.typography.labelLarge)
                if (lines.isNotEmpty()) {
                    Button(onClick = onClear) { Text("消去") }
                }
            }
            Column(
                Modifier.heightIn(max = 120.dp).verticalScroll(rememberScrollState()),
            ) {
                if (lines.isEmpty()) {
                    Text(
                        "操作するとここに副作用が出ます",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                lines.forEach {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
