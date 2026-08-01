package dev.spectre.core

/**
 * SDK がホストアプリに要求する接続点。これ以上増やさない (docs/architecture.md §6)。
 *
 * iOS 側も同じシグネチャの `SpectreHostDelegate` を持つ。
 */
interface SpectreHostDelegate {

    /**
     * 論理エンドポイント名を実リクエストに解決して実行する。
     *
     * ベース URL・認証ヘッダ・リトライ・証明書ピンニングはすべてホストアプリの責務。
     * ドキュメントには論理名しか書かれていないため、内部 URL や資格情報が
     * CDN にキャッシュされる公開物に載ることがない。
     */
    suspend fun performRequest(request: SpectreRequest): SpectreActionResponse

    /**
     * ドキュメントで表現できない画面遷移。既存のルーティングに委ねる。
     * @return 遷移を引き受けたら true。false ならテレメトリに記録され、何も起きない。
     */
    fun navigate(destination: SpectreDestination): Boolean

    /** 共有シート・決済・カメラなど、SDUI で表現すべきでない機能への委譲。 */
    suspend fun performHostAction(name: String, params: SpValue): SpValue?

    /** 計測イベントの転送先。 */
    fun track(event: String, properties: SpValue)

    /**
     * 外部 URL を開く。ドメインのアロウリスト判定はホストアプリが行う。
     * @return 開いたら true。
     */
    fun openUrl(url: String, mode: String): Boolean

    /**
     * アクション実行前の割り込み機会。false を返すとその時点で中止する。
     */
    fun shouldPerform(action: SpValue): Boolean = true
}

data class SpectreRequest(
    val endpoint: String,
    val method: String,
    val pathParams: Map<String, SpValue> = emptyMap(),
    val query: Map<String, SpValue> = emptyMap(),
    val body: SpValue = SpValue.Null,
    val timeoutMs: Int = 10_000,
    val idempotencyKey: String? = null,
)

/**
 * `request` に対するサーバ応答 (docs/spec/actions.md §3)。
 * 適用順は screen -> data -> state -> patch -> actions。
 */
data class SpectreActionResponse(
    val ok: Boolean,
    val data: SpValue.Obj? = null,
    val state: SpValue.Obj? = null,
    val patch: List<SpValue> = emptyList(),
    val screen: SpValue.Obj? = null,
    val actions: List<SpValue> = emptyList(),
    val error: SpectreErrorPayload? = null,
) {
    companion object {
        fun failure(code: String, message: String): SpectreActionResponse =
            SpectreActionResponse(ok = false, error = SpectreErrorPayload(code, message))

        /** サーバの生 JSON から応答を組み立てる。 */
        fun from(ok: Boolean, body: SpValue): SpectreActionResponse {
            val obj = body as? SpValue.Obj ?: return SpectreActionResponse(ok = ok)
            val errorObj = obj.entries["error"] as? SpValue.Obj
            return SpectreActionResponse(
                ok = ok && errorObj == null,
                data = obj.entries["data"] as? SpValue.Obj,
                state = obj.entries["state"] as? SpValue.Obj,
                patch = (obj.entries["patch"] as? SpValue.Arr)?.items ?: emptyList(),
                screen = obj.entries["screen"] as? SpValue.Obj,
                actions = (obj.entries["actions"] as? SpValue.Arr)?.items ?: emptyList(),
                error = errorObj?.let {
                    SpectreErrorPayload(
                        code = it.entries["code"]?.asStringOrNull ?: "UNKNOWN",
                        message = it.entries["message"]?.asStringOrNull ?: "",
                        fields = (it.entries["fields"] as? SpValue.Obj) ?: SpValue.EmptyObj,
                    )
                },
            )
        }
    }
}

data class SpectreErrorPayload(
    val code: String,
    val message: String,
    val fields: SpValue.Obj = SpValue.EmptyObj,
) {
    /** onError ハンドラの式から `${error.code}` として参照できる形。 */
    fun toScopeValue(): SpValue = SpValue.Obj(
        mapOf(
            "code" to SpValue.Str(code),
            "message" to SpValue.Str(message),
            "fields" to fields,
        )
    )
}

data class SpectreDestination(
    val mode: String,
    val screen: String? = null,
    val route: String? = null,
    val params: Map<String, SpValue> = emptyMap(),
)

/**
 * SDK 内部の UI 副作用。オーバレイの開閉やフォーカス移動など、
 * ホストアプリではなく描画層が処理するもの。
 */
sealed interface SpectreUiEffect {
    data class ShowOverlay(val id: String) : SpectreUiEffect
    data class DismissOverlay(val id: String?) : SpectreUiEffect
    data object Back : SpectreUiEffect
    data object Dismiss : SpectreUiEffect
    data class Refresh(val preserveState: Boolean) : SpectreUiEffect
    data class Focus(val nodeId: String) : SpectreUiEffect
    data class ScrollTo(val nodeId: String, val animated: Boolean) : SpectreUiEffect
    data class ReplaceScreen(val document: SpValue.Obj) : SpectreUiEffect

    /** ドキュメントの部分更新。適用は ScreenController が行う。 */
    data class ApplyPatch(val operations: List<SpValue>) : SpectreUiEffect
}
