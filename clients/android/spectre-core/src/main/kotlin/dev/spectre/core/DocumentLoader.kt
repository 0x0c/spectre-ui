package dev.spectre.core

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * `screenId` を実際に取得する手段をホストアプリに委ねるための接続点
 * (docs/architecture.md §2, §6)。
 *
 * `SpectreHostDelegate.performRequest` とは別に用意しているのは、`request` が
 * 論理エンドポイント名を経由するアクション実行なのに対し、こちらはドキュメント配信
 * そのもの — ベース URL・CDN・署名検証など、性質が異なるからである
 * (docs/architecture.md §3.1 のデータフロー図で SDK がサーバ/CDN に直接繋いでいる部分)。
 */
interface SpectreDocumentTransport {
    suspend fun fetch(
        screenId: String,
        params: Map<String, String>,
        ifNoneMatch: String?,
    ): SpectreDocumentTransportResult
}

sealed interface SpectreDocumentTransportResult {
    /** 200 とドキュメント本文。 */
    data class Fresh(val body: String, val etag: String?, val maxAgeSec: Int?) : SpectreDocumentTransportResult

    /** 304 — `ifNoneMatch` と一致し、キャッシュ済みの本文をそのまま使ってよい。 */
    data object NotModified : SpectreDocumentTransportResult

    /** 到達不能・タイムアウト・サーバエラーなど。 */
    data class Failure(val message: String) : SpectreDocumentTransportResult
}

enum class DocumentSource { MEMORY, DISK, BUNDLED, NETWORK }

sealed interface DocumentLoadResult {
    data class Loaded(val document: Document, val source: DocumentSource, val stale: Boolean) : DocumentLoadResult
    data class Failed(val message: String) : DocumentLoadResult
}

/**
 * `screenId` -> [Document] の3層キャッシュ + stale-while-revalidate (docs/architecture.md §2)。
 *
 * - メモリ (LRU) -> ディスク -> アプリ同梱のバンドル済みフォールバックの順に探す。
 * - 期限切れ・存在しないキャッシュでも、見つかった時点でまず即時描画用に流し、
 *   その裏でネットワークから最新を取りに行って差し替える。初回以外は必ず即時描画になる。
 * - ネットワーク到達不能かつキャッシュが何もないときにどう振る舞うかはホストアプリの
 *   責務 (`bundledProvider` が null を返せば [DocumentLoadResult.Failed] になり、
 *   host 側の `fallbackView` 相当の表示に委ねられる)。
 */
class DocumentLoader(
    private val transport: SpectreDocumentTransport,
    /** ディスク層の保存先。null ならディスク層を持たない (メモリとバンドルのみ)。 */
    private val cacheDir: File? = null,
    /** アプリ同梱のバンドル済みフォールバック (アセット等) を返す。ネットワークにもキャッシュにもない場合の最後の手段。 */
    private val bundledProvider: ((screenId: String) -> String?)? = null,
    private val memoryCacheSize: Int = 20,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private data class CachedBody(
        val body: String,
        val etag: String?,
        val storedAtMs: Long,
        val maxAgeSec: Int?,
    )

    private val memoryCache = object : LinkedHashMap<String, CachedBody>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedBody>): Boolean =
            size > memoryCacheSize
    }

    /**
     * [screenId] の読み込みを開始する。stale-while-revalidate のため、キャッシュ済みの
     * 値があれば1件目としてすぐに流れ、ネットワークから取得できた時点でもう1件流れる
     * (キャッシュがなければネットワーク到達を待つ1件だけになる)。
     */
    fun load(screenId: String, params: Map<String, String> = emptyMap()): Flow<DocumentLoadResult> = flow {
        val key = cacheKey(screenId, params)
        val fromMemory = readMemory(key)
        val cacheSource = if (fromMemory != null) DocumentSource.MEMORY else DocumentSource.DISK
        var cached = fromMemory ?: readDisk(key)?.also { writeMemory(key, it) }
        var emittedFromCache = false

        if (cached != null) {
            parseOrNull(cached.body)?.let { document ->
                emit(DocumentLoadResult.Loaded(document, cacheSource, stale = true))
                emittedFromCache = true
            }
        } else {
            bundledProvider?.invoke(screenId)?.let { body ->
                parseOrNull(body)?.let { document ->
                    emit(DocumentLoadResult.Loaded(document, DocumentSource.BUNDLED, stale = true))
                    emittedFromCache = true
                }
            }
        }

        val transportResult = runCatching { transport.fetch(screenId, params, cached?.etag) }
            .getOrElse { SpectreDocumentTransportResult.Failure(it.message ?: "ネットワークエラー") }

        when (transportResult) {
            is SpectreDocumentTransportResult.Fresh -> {
                val document = parseOrNull(transportResult.body)
                if (document != null) {
                    val entry = CachedBody(transportResult.body, transportResult.etag, clock(), transportResult.maxAgeSec)
                    writeMemory(key, entry)
                    writeDisk(key, entry)
                    emit(DocumentLoadResult.Loaded(document, DocumentSource.NETWORK, stale = false))
                } else if (!emittedFromCache) {
                    emit(DocumentLoadResult.Failed("サーバから届いたドキュメントを解析できません"))
                }
            }

            is SpectreDocumentTransportResult.NotModified -> {
                val current = cached
                if (current != null) {
                    val refreshed = current.copy(storedAtMs = clock())
                    writeMemory(key, refreshed)
                    writeDisk(key, refreshed)
                    if (!emittedFromCache) {
                        parseOrNull(current.body)?.let {
                            emit(DocumentLoadResult.Loaded(it, DocumentSource.NETWORK, stale = false))
                        }
                    }
                }
            }

            is SpectreDocumentTransportResult.Failure -> {
                if (!emittedFromCache) emit(DocumentLoadResult.Failed(transportResult.message))
            }
        }
    }

    private fun parseOrNull(body: String): Document? = runCatching { DocumentParser.parse(body) }.getOrNull()

    private fun cacheKey(screenId: String, params: Map<String, String>): String {
        if (params.isEmpty()) return screenId
        val sorted = params.toSortedMap().entries.joinToString("&") { "${it.key}=${it.value}" }
        return "$screenId?$sorted"
    }

    @Synchronized
    private fun readMemory(key: String): CachedBody? = memoryCache[key]

    @Synchronized
    private fun writeMemory(key: String, entry: CachedBody) {
        memoryCache[key] = entry
    }

    private fun readDisk(key: String): CachedBody? {
        val dir = cacheDir ?: return null
        val (bodyFile, metaFile) = diskFiles(dir, key)
        if (!bodyFile.isFile || !metaFile.isFile) return null
        return runCatching {
            val body = bodyFile.readText()
            val meta = metaFile.readLines().associate {
                val (k, v) = it.split('=', limit = 2)
                k to v
            }
            CachedBody(
                body = body,
                etag = meta["etag"]?.takeIf { it.isNotEmpty() },
                storedAtMs = meta["storedAtMs"]?.toLongOrNull() ?: 0L,
                maxAgeSec = meta["maxAgeSec"]?.toIntOrNull(),
            )
        }.getOrNull()
    }

    private fun writeDisk(key: String, entry: CachedBody) {
        val dir = cacheDir ?: return
        runCatching {
            dir.mkdirs()
            val (bodyFile, metaFile) = diskFiles(dir, key)
            bodyFile.writeText(entry.body)
            metaFile.writeText(
                "etag=${entry.etag.orEmpty()}\n" +
                    "storedAtMs=${entry.storedAtMs}\n" +
                    "maxAgeSec=${entry.maxAgeSec ?: ""}\n"
            )
        }
    }

    private fun diskFiles(dir: File, key: String): Pair<File, File> {
        val digest = MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
        val hash = digest.joinToString("") { "%02x".format(it) }
        return File(dir, "$hash.body") to File(dir, "$hash.meta")
    }
}
