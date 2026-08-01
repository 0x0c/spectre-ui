package dev.spectre.sample

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.Toast
import dev.spectre.core.SpValue
import dev.spectre.core.SpectreActionResponse
import dev.spectre.core.SpectreDestination
import dev.spectre.core.SpectreHostDelegate
import dev.spectre.core.SpectreRequest
import dev.spectre.core.stringify
import kotlinx.coroutines.delay

/**
 * サンプルアプリのホスト実装。
 *
 * ここが「SDK がホストアプリに要求するもの」のすべて (docs/architecture.md §6)。
 * 実アプリではこの中で既存のネットワーク層・ルーティング・計測基盤に繋ぐ。
 *
 * サンプルではサーバを立てずに応答を模擬している。重要なのは
 * **論理エンドポイント名 -> 実リクエスト の解決がホスト側にある**という構造で、
 * これによりドキュメントに内部 URL や認証情報が載ることがない。
 */
class SampleHostDelegate(
    private val context: Context,
    private val onEvent: (String) -> Unit = {},
) : SpectreHostDelegate {

    /** ホストが受け付ける論理エンドポイント。ここにない名前は実行されない。 */
    private val registeredEndpoints = setOf("cart.add", "settings.save")

    /** ホストが受け付ける URL のドメイン。ここにないホストは開かない。 */
    private val allowedUrlHosts = setOf("example.com", "www.example.com")

    /** ホストが提供する機能。ドキュメントからは `host` アクションで呼ばれる。 */
    private val registeredHostActions = setOf("share")

    override suspend fun performRequest(request: SpectreRequest): SpectreActionResponse {
        if (request.endpoint !in registeredEndpoints) {
            Log.w(TAG, "未登録のエンドポイント: ${request.endpoint}")
            return SpectreActionResponse.failure(
                "ENDPOINT_NOT_REGISTERED",
                "エンドポイント '${request.endpoint}' は登録されていません",
            )
        }

        onEvent("→ ${request.method} ${request.endpoint} ${request.body.stringify()}")
        delay(600) // ネットワーク往復の体感を出すための待ち

        return when (request.endpoint) {
            "cart.add" -> {
                // サーバが返した値を data にマージする形の応答
                val qty = (request.body as? SpValue.Obj)?.entries?.get("qty")?.stringify() ?: "1"
                SpectreActionResponse(
                    ok = true,
                    state = SpValue.Obj(mapOf("cartCount" to SpValue.Str(qty))),
                )
            }

            "settings.save" -> {
                // 3回に1回失敗させて onError 側の経路も確認できるようにする
                failureCounter++
                if (failureCounter % 3 == 0) {
                    SpectreActionResponse.failure("SERVER_BUSY", "サーバが混み合っています")
                } else {
                    SpectreActionResponse(ok = true)
                }
            }

            else -> SpectreActionResponse(ok = true)
        }
    }

    override fun navigate(destination: SpectreDestination): Boolean {
        // サンプルには遷移先の画面がないので、受け取ったことだけを見せる
        onEvent("navigate ${destination.mode} ${destination.screen ?: destination.route ?: ""}")
        return false
    }

    override suspend fun performHostAction(name: String, params: SpValue): SpValue? {
        if (name !in registeredHostActions) {
            Log.w(TAG, "未登録の host アクション: $name")
            throw IllegalArgumentException("host アクション '$name' は登録されていません")
        }
        onEvent("host:$name")
        if (name == "share") {
            val obj = params as? SpValue.Obj
            val text = obj?.entries?.get("text")?.stringify().orEmpty()
            val url = obj?.entries?.get("url")?.stringify().orEmpty()
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, listOf(text, url).filter { it.isNotEmpty() }.joinToString("\n"))
            }
            context.startActivity(Intent.createChooser(intent, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        return null
    }

    override fun track(event: String, properties: SpValue) {
        onEvent("track $event ${properties.stringify()}")
        Log.d(TAG, "track $event ${properties.stringify()}")
    }

    override fun openUrl(url: String, mode: String): Boolean {
        val host = runCatching { Uri.parse(url).host }.getOrNull()
        if (host == null || host !in allowedUrlHosts) {
            // アロウリスト外は開かない。ドキュメントは公開物なので、
            // 任意の URL を開けるとフィッシングの経路になる。
            Log.w(TAG, "アロウリスト外の URL: $url")
            Toast.makeText(context, "許可されていないURLです: $url", Toast.LENGTH_SHORT).show()
            return false
        }
        onEvent("openUrl $url")
        runCatching {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
        return true
    }

    private var failureCounter = 0

    private companion object {
        const val TAG = "SpectreSample"
    }
}
