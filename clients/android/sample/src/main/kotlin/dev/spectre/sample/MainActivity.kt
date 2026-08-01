package dev.spectre.sample

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
import dev.spectre.core.DocumentParser
import dev.spectre.ui.SpectreScreen
import dev.spectre.ui.rememberSpectreEnv

/**
 * サーバードリブン UI のサンプル。
 *
 * サーバを立てる代わりに、examples/screens 以下の JSON をアセットから読み込んで
 * そのまま描画する。配信経路が変わってもクライアント側の処理は同じで、
 * 「JSON を受け取って描画し、操作に反応する」ところを確認できる。
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

private val SAMPLE_SCREENS = listOf(
    "商品詳細" to "screens/product-detail.json",
    "通知設定" to "screens/settings-form.json",
)

@Composable
private fun SampleApp() {
    val context = LocalContext.current
    var selected by remember { mutableStateOf(0) }
    var document by remember { mutableStateOf<Document?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val eventLog = remember { mutableStateListOf<String>() }

    val host = remember { SampleHostDelegate(context) { line -> eventLog.add(0, line) } }
    val env = rememberSpectreEnv(appVersion = "1.0.0")

    LaunchedEffect(selected) {
        eventLog.clear()
        loadError = null
        document = runCatching {
            val json = context.assets.open(SAMPLE_SCREENS[selected].second)
                .bufferedReader()
                .use { it.readText() }
            DocumentParser.parse(json)
        }.onFailure { loadError = it.message ?: it.toString() }.getOrNull()
    }

    Column(Modifier.fillMaxSize()) {
        // 画面切り替え。実アプリではサーバから screenId で引く部分。
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SAMPLE_SCREENS.forEachIndexed { index, (label, _) ->
                FilterChip(
                    selected = index == selected,
                    onClick = { selected = index },
                    label = { Text(label) },
                )
            }
        }

        Box(Modifier.weight(1f)) {
            val doc = document
            when {
                loadError != null -> ErrorPanel(loadError!!)
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
