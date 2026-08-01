import Foundation

/// `screenId` を実際に取得する手段をホストアプリに委ねるための接続点
/// (docs/architecture.md §2, §6)。
///
/// `SpectreHostDelegate.performRequest` とは別に用意しているのは、`request` が
/// 論理エンドポイント名を経由するアクション実行なのに対し、こちらはドキュメント配信
/// そのもの — ベース URL・CDN・署名検証など、性質が異なるからである
/// (docs/architecture.md §3.1 のデータフロー図で SDK がサーバ/CDN に直接繋いでいる部分)。
public protocol SpectreDocumentTransport: Sendable {
    func fetch(screenId: String, params: [String: String], ifNoneMatch: String?) async -> SpectreDocumentTransportResult
}

public enum SpectreDocumentTransportResult: Sendable {
    /// 200 とドキュメント本文。
    case fresh(body: String, etag: String?, maxAgeSec: Int?)
    /// 304 — `ifNoneMatch` と一致し、キャッシュ済みの本文をそのまま使ってよい。
    case notModified
    /// 到達不能・タイムアウト・サーバエラーなど。
    case failure(message: String)
}

public enum DocumentSource: Sendable {
    case memory, disk, bundled, network
}

public enum DocumentLoadResult: Sendable {
    case loaded(document: Document, source: DocumentSource, stale: Bool)
    case failed(message: String)
}

/// `screenId` -> `Document` の3層キャッシュ + stale-while-revalidate (docs/architecture.md §2)。
///
/// - メモリ (LRU) -> ディスク -> アプリ同梱のバンドル済みフォールバックの順に探す。
/// - 期限切れ・存在しないキャッシュでも、見つかった時点でまず即時描画用に流し、
///   その裏でネットワークから最新を取りに行って差し替える。初回以外は必ず即時描画になる。
/// - ネットワーク到達不能かつキャッシュが何もないときにどう振る舞うかはホストアプリの
///   責務 (`bundledProvider` が nil を返せば `.failed` になり、host 側の
///   `fallbackView` 相当の表示に委ねられる)。
public final class DocumentLoader: Sendable {
    private struct CachedBody: Sendable {
        let body: String
        let etag: String?
        let storedAtMs: Int64
        let maxAgeSec: Int?
    }

    private let transport: SpectreDocumentTransport
    /// ディスク層の保存先。nil ならディスク層を持たない (メモリとバンドルのみ)。
    private let cacheDir: URL?
    /// アプリ同梱のバンドル済みフォールバック (リソース等) を返す。ネットワークにもキャッシュにもない場合の最後の手段。
    private let bundledProvider: (@Sendable (_ screenId: String) -> String?)?
    private let memoryCacheSize: Int
    private let clock: @Sendable () -> Int64
    private let memoryCache: MemoryCache

    public init(
        transport: SpectreDocumentTransport,
        cacheDir: URL? = nil,
        bundledProvider: (@Sendable (_ screenId: String) -> String?)? = nil,
        memoryCacheSize: Int = 20,
        clock: @escaping @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    ) {
        self.transport = transport
        self.cacheDir = cacheDir
        self.bundledProvider = bundledProvider
        self.memoryCacheSize = memoryCacheSize
        self.clock = clock
        self.memoryCache = MemoryCache(capacity: memoryCacheSize)
    }

    /// `screenId` の読み込みを開始する。stale-while-revalidate のため、キャッシュ済みの
    /// 値があれば1件目としてすぐに流れ、ネットワークから取得できた時点でもう1件流れる
    /// (キャッシュがなければネットワーク到達を待つ1件だけになる)。
    public func load(screenId: String, params: [String: String] = [:]) -> AsyncStream<DocumentLoadResult> {
        AsyncStream { continuation in
            Task {
                await self.run(screenId: screenId, params: params, continuation: continuation)
                continuation.finish()
            }
        }
    }

    private func run(
        screenId: String,
        params: [String: String],
        continuation: AsyncStream<DocumentLoadResult>.Continuation
    ) async {
        let key = Self.cacheKey(screenId: screenId, params: params)
        let fromMemory = await memoryCache.get(key)
        let cacheSource: DocumentSource = fromMemory != nil ? .memory : .disk
        var cached = fromMemory
        if cached == nil, let fromDisk = readDisk(key: key) {
            cached = fromDisk
            await memoryCache.set(key, fromDisk)
        }

        var emittedFromCache = false
        if let cached {
            if let document = Self.parseOrNil(cached.body) {
                continuation.yield(.loaded(document: document, source: cacheSource, stale: true))
                emittedFromCache = true
            }
        } else if let body = bundledProvider?(screenId), let document = Self.parseOrNil(body) {
            continuation.yield(.loaded(document: document, source: .bundled, stale: true))
            emittedFromCache = true
        }

        let transportResult = await transport.fetch(screenId: screenId, params: params, ifNoneMatch: cached?.etag)

        switch transportResult {
        case .fresh(let body, let etag, let maxAgeSec):
            if let document = Self.parseOrNil(body) {
                let entry = CachedBody(body: body, etag: etag, storedAtMs: clock(), maxAgeSec: maxAgeSec)
                await memoryCache.set(key, entry)
                writeDisk(key: key, entry: entry)
                continuation.yield(.loaded(document: document, source: .network, stale: false))
            } else if !emittedFromCache {
                continuation.yield(.failed(message: "サーバから届いたドキュメントを解析できません"))
            }

        case .notModified:
            if let current = cached {
                let refreshed = CachedBody(body: current.body, etag: current.etag, storedAtMs: clock(), maxAgeSec: current.maxAgeSec)
                await memoryCache.set(key, refreshed)
                writeDisk(key: key, entry: refreshed)
                if !emittedFromCache, let document = Self.parseOrNil(current.body) {
                    continuation.yield(.loaded(document: document, source: .network, stale: false))
                }
            }

        case .failure(let message):
            if !emittedFromCache {
                continuation.yield(.failed(message: message))
            }
        }
    }

    private static func parseOrNil(_ body: String) -> Document? {
        try? DocumentParser.parse(text: body)
    }

    private static func cacheKey(screenId: String, params: [String: String]) -> String {
        guard !params.isEmpty else { return screenId }
        let sorted = params.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return "\(screenId)?\(sorted)"
    }

    // MARK: - ディスク層

    private func readDisk(key: String) -> CachedBody? {
        guard let dir = cacheDir else { return nil }
        let (bodyFile, metaFile) = diskFiles(dir: dir, key: key)
        guard let body = try? String(contentsOf: bodyFile, encoding: .utf8),
              let metaText = try? String(contentsOf: metaFile, encoding: .utf8) else { return nil }
        var meta: [String: String] = [:]
        for line in metaText.split(separator: "\n") {
            let parts = line.split(separator: "=", maxSplits: 1)
            guard parts.count == 2 else { continue }
            meta[String(parts[0])] = String(parts[1])
        }
        return CachedBody(
            body: body,
            etag: meta["etag"]?.isEmpty == false ? meta["etag"] : nil,
            storedAtMs: meta["storedAtMs"].flatMap { Int64($0) } ?? 0,
            maxAgeSec: meta["maxAgeSec"].flatMap { Int($0) }
        )
    }

    private func writeDisk(key: String, entry: CachedBody) {
        guard let dir = cacheDir else { return }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let (bodyFile, metaFile) = diskFiles(dir: dir, key: key)
        try? entry.body.write(to: bodyFile, atomically: true, encoding: .utf8)
        let meta = "etag=\(entry.etag ?? "")\nstoredAtMs=\(entry.storedAtMs)\nmaxAgeSec=\(entry.maxAgeSec.map(String.init) ?? "")\n"
        try? meta.write(to: metaFile, atomically: true, encoding: .utf8)
    }

    private func diskFiles(dir: URL, key: String) -> (body: URL, meta: URL) {
        let hash = Self.stableHashHex(key)
        return (dir.appendingPathComponent("\(hash).body"), dir.appendingPathComponent("\(hash).meta"))
    }

    /// キャッシュファイル名を安全な文字だけの固定長文字列にするための、暗号強度を
    /// 必要としない安定ハッシュ (FNV-1a, 64bit)。`screenId` はクエリパラメータや
    /// スラッシュを含みうるため、そのままファイル名にはできない。
    private static func stableHashHex(_ value: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return String(format: "%016x", hash)
    }

    /// メモリキャッシュ (LRU)。複数タスクから並行に読み書きされるため actor で直列化する。
    private actor MemoryCache {
        private var order: [String] = []
        private var entries: [String: CachedBody] = [:]
        private let capacity: Int

        init(capacity: Int) {
            self.capacity = capacity
        }

        func get(_ key: String) -> CachedBody? {
            entries[key]
        }

        func set(_ key: String, _ value: CachedBody) {
            if entries[key] == nil {
                order.append(key)
                if order.count > capacity {
                    let evicted = order.removeFirst()
                    entries.removeValue(forKey: evicted)
                }
            }
            entries[key] = value
        }
    }
}
