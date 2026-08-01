package dev.spectre.core

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import java.io.File
import kotlin.io.path.createTempDirectory
import org.junit.jupiter.api.DisplayName
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * [DocumentLoader] の3層キャッシュと stale-while-revalidate を検証する
 * (docs/architecture.md §2)。
 */
class DocumentLoaderTest {

    private val tempDir = createTempDirectory("spectre-doc-cache").toFile()

    @AfterTest
    fun cleanup() {
        tempDir.deleteRecursively()
    }

    private fun documentBody(title: String) = """
        {"schemaVersion":"1.0","id":"s","meta":{"title":"$title"},"root":{"type":"Screen"}}
    """.trimIndent()

    private class FakeTransport(
        var result: SpectreDocumentTransportResult,
    ) : SpectreDocumentTransport {
        var lastIfNoneMatch: String? = null
        var calls = 0
        override suspend fun fetch(
            screenId: String,
            params: Map<String, String>,
            ifNoneMatch: String?,
        ): SpectreDocumentTransportResult {
            calls++
            lastIfNoneMatch = ifNoneMatch
            return result
        }
    }

    @Test
    @DisplayName("キャッシュが何もなければネットワークの結果だけが流れる")
    fun emitsOnlyNetworkResultWhenNoCacheExists() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Fresh(documentBody("v1"), "etag-1", 60))
        val loader = DocumentLoader(transport)

        val results = loader.load("s").toList()

        assertEquals(1, results.size)
        val loaded = assertIs<DocumentLoadResult.Loaded>(results[0])
        assertEquals(DocumentSource.NETWORK, loaded.source)
        assertEquals(false, loaded.stale)
        assertEquals("v1", loaded.document.meta.title)
    }

    @Test
    @DisplayName("メモリキャッシュがあれば stale を即時に流してからネットワーク結果で差し替える")
    fun emitsStaleMemoryHitThenNetworkResult() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Fresh(documentBody("v2"), "etag-2", 60))
        val loader = DocumentLoader(transport)

        // 1回目でメモリキャッシュを埋める。
        loader.load("s").toList()
        transport.result = SpectreDocumentTransportResult.Fresh(documentBody("v3"), "etag-3", 60)

        val results = loader.load("s").toList()

        assertEquals(2, results.size)
        val stale = assertIs<DocumentLoadResult.Loaded>(results[0])
        assertEquals(DocumentSource.MEMORY, stale.source)
        assertEquals(true, stale.stale)
        assertEquals("v2", stale.document.meta.title)

        val fresh = assertIs<DocumentLoadResult.Loaded>(results[1])
        assertEquals(DocumentSource.NETWORK, fresh.source)
        assertEquals(false, fresh.stale)
        assertEquals("v3", fresh.document.meta.title)

        // 2回目の fetch は1回目の etag を If-None-Match として送っている。
        assertEquals("etag-2", transport.lastIfNoneMatch)
    }

    @Test
    @DisplayName("ディスクキャッシュはメモリキャッシュがなくなった後も生き残る")
    fun diskCacheSurvivesAcrossLoaderInstances() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Fresh(documentBody("v4"), "etag-4", 60))
        val diskDir = File(tempDir, "disk")

        DocumentLoader(transport, cacheDir = diskDir).load("s").toList()

        // 新しい DocumentLoader インスタンス (=新しいメモリキャッシュ) でもディスクは共有される。
        transport.result = SpectreDocumentTransportResult.Failure("network down")
        val results = DocumentLoader(transport, cacheDir = diskDir).load("s").toList()

        // ディスクの stale を流した後、ネットワークが失敗しても Failed は追加で出ない
        // (すでに表示できるものがあるため)。
        assertEquals(1, results.size)
        val fromDisk = assertIs<DocumentLoadResult.Loaded>(results[0])
        assertEquals(DocumentSource.DISK, fromDisk.source)
        assertEquals("v4", fromDisk.document.meta.title)
    }

    @Test
    @DisplayName("304 応答はキャッシュ済みの本文をそのまま鮮度更新して使う")
    fun notModifiedRefreshesCachedEntryWithoutRefetchingBody() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Fresh(documentBody("v5"), "etag-5", 60))
        val loader = DocumentLoader(transport)
        loader.load("s").toList()

        transport.result = SpectreDocumentTransportResult.NotModified
        val results = loader.load("s").toList()

        // stale の1件で内容がすでに正しいので、304 後に同じ内容をもう一度流す必要はない。
        assertEquals(1, results.size)
        val loaded = assertIs<DocumentLoadResult.Loaded>(results[0])
        assertEquals("v5", loaded.document.meta.title)
    }

    @Test
    @DisplayName("キャッシュもネットワークもなければバンドル済みフォールバックを使う")
    fun fallsBackToBundledProviderWhenNothingElseIsAvailable() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Failure("network down"))
        val loader = DocumentLoader(
            transport,
            bundledProvider = { screenId -> if (screenId == "s") documentBody("bundled") else null },
        )

        val results = loader.load("s").toList()

        assertEquals(1, results.size)
        val loaded = assertIs<DocumentLoadResult.Loaded>(results[0])
        assertEquals(DocumentSource.BUNDLED, loaded.source)
        assertEquals("bundled", loaded.document.meta.title)
    }

    @Test
    @DisplayName("何もなければ失敗を返す")
    fun reportsFailureWhenNothingIsAvailable() = runBlocking {
        val transport = FakeTransport(SpectreDocumentTransportResult.Failure("network down"))
        val loader = DocumentLoader(transport)

        val results = loader.load("s").toList()

        assertEquals(1, results.size)
        val failed = assertIs<DocumentLoadResult.Failed>(results[0])
        assertEquals("network down", failed.message)
    }
}
