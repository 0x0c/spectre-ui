import XCTest
@testable import SpectreCore

/// `DocumentLoader` の3層キャッシュと stale-while-revalidate を検証する
/// (docs/architecture.md §2)。Kotlin 側 (`DocumentLoaderTest.kt`) と同じ観点を確認する。
final class DocumentLoaderTests: XCTestCase {

    private var tempDir: URL!

    override func setUpWithError() throws {
        tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tempDir)
    }

    private func documentBody(_ title: String) -> String {
        "{\"schemaVersion\":\"1.0\",\"id\":\"s\",\"meta\":{\"title\":\"\(title)\"},\"root\":{\"type\":\"Screen\"}}"
    }

    private actor FakeTransport: SpectreDocumentTransport {
        var result: SpectreDocumentTransportResult
        var lastIfNoneMatch: String?

        init(_ result: SpectreDocumentTransportResult) {
            self.result = result
        }

        func setResult(_ value: SpectreDocumentTransportResult) {
            result = value
        }

        func fetch(screenId: String, params: [String: String], ifNoneMatch: String?) async -> SpectreDocumentTransportResult {
            lastIfNoneMatch = ifNoneMatch
            return result
        }
    }

    private func collectAll(_ stream: AsyncStream<DocumentLoadResult>) async -> [DocumentLoadResult] {
        var out: [DocumentLoadResult] = []
        for await item in stream { out.append(item) }
        return out
    }

    func testEmitsOnlyNetworkResultWhenNoCacheExists() async throws {
        let transport = FakeTransport(.fresh(body: documentBody("v1"), etag: "etag-1", maxAgeSec: 60))
        let loader = DocumentLoader(transport: transport)

        let results = await collectAll(loader.load(screenId: "s"))

        XCTAssertEqual(results.count, 1)
        guard case .loaded(let document, let source, let stale) = results[0] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(source, .network)
        XCTAssertFalse(stale)
        XCTAssertEqual(document.meta.title, "v1")
    }

    func testEmitsStaleMemoryHitThenNetworkResult() async throws {
        let transport = FakeTransport(.fresh(body: documentBody("v2"), etag: "etag-2", maxAgeSec: 60))
        let loader = DocumentLoader(transport: transport)

        _ = await collectAll(loader.load(screenId: "s"))
        await transport.setResult(.fresh(body: documentBody("v3"), etag: "etag-3", maxAgeSec: 60))

        let results = await collectAll(loader.load(screenId: "s"))

        XCTAssertEqual(results.count, 2)
        guard case .loaded(let staleDoc, let staleSource, let stale) = results[0] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(staleSource, .memory)
        XCTAssertTrue(stale)
        XCTAssertEqual(staleDoc.meta.title, "v2")

        guard case .loaded(let freshDoc, let freshSource, let freshStale) = results[1] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(freshSource, .network)
        XCTAssertFalse(freshStale)
        XCTAssertEqual(freshDoc.meta.title, "v3")

        let lastIfNoneMatch = await transport.lastIfNoneMatch
        XCTAssertEqual(lastIfNoneMatch, "etag-2")
    }

    func testDiskCacheSurvivesAcrossLoaderInstances() async throws {
        let transport = FakeTransport(.fresh(body: documentBody("v4"), etag: "etag-4", maxAgeSec: 60))
        let diskDir = tempDir.appendingPathComponent("disk")

        _ = await collectAll(DocumentLoader(transport: transport, cacheDir: diskDir).load(screenId: "s"))

        await transport.setResult(.failure(message: "network down"))
        let results = await collectAll(DocumentLoader(transport: transport, cacheDir: diskDir).load(screenId: "s"))

        // ディスクの stale を流した後、ネットワークが失敗しても失敗は追加で出ない
        // (すでに表示できるものがあるため)。
        XCTAssertEqual(results.count, 1)
        guard case .loaded(let document, let source, _) = results[0] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(source, .disk)
        XCTAssertEqual(document.meta.title, "v4")
    }

    func testNotModifiedRefreshesCachedEntryWithoutRefetchingBody() async throws {
        let transport = FakeTransport(.fresh(body: documentBody("v5"), etag: "etag-5", maxAgeSec: 60))
        let loader = DocumentLoader(transport: transport)
        _ = await collectAll(loader.load(screenId: "s"))

        await transport.setResult(.notModified)
        let results = await collectAll(loader.load(screenId: "s"))

        // stale の1件で内容がすでに正しいので、304 後に同じ内容をもう一度流す必要はない。
        XCTAssertEqual(results.count, 1)
        guard case .loaded(let document, _, _) = results[0] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(document.meta.title, "v5")
    }

    func testFallsBackToBundledProviderWhenNothingElseIsAvailable() async throws {
        let transport = FakeTransport(.failure(message: "network down"))
        let bundledBody = documentBody("bundled")
        let loader = DocumentLoader(
            transport: transport,
            bundledProvider: { screenId in screenId == "s" ? bundledBody : nil }
        )

        let results = await collectAll(loader.load(screenId: "s"))

        XCTAssertEqual(results.count, 1)
        guard case .loaded(let document, let source, _) = results[0] else {
            return XCTFail("expected .loaded")
        }
        XCTAssertEqual(source, .bundled)
        XCTAssertEqual(document.meta.title, "bundled")
    }

    func testReportsFailureWhenNothingIsAvailable() async throws {
        let transport = FakeTransport(.failure(message: "network down"))
        let loader = DocumentLoader(transport: transport)

        let results = await collectAll(loader.load(screenId: "s"))

        XCTAssertEqual(results.count, 1)
        guard case .failed(let message) = results[0] else {
            return XCTFail("expected .failed")
        }
        XCTAssertEqual(message, "network down")
    }
}
