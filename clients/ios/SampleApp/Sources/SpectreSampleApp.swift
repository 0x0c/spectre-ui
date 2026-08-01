import SwiftUI
import SpectreCore
import SpectreUI

/// サーバードリブン UI のサンプル。
///
/// サーバを立てる代わりに `BundleDocumentTransport` がバンドル内の JSON をネットワーク
/// 応答のふりをして返す。それでも `DocumentLoader` は本物の配信経路と同じ形
/// (メモリ→ディスク→バンドルの3層キャッシュ + stale-while-revalidate) で動くので、
/// 画面を切り替えて戻すと挙動の違いが観察できる (docs/architecture.md §2)。
@main
struct SpectreSampleApp: App {
    var body: some Scene {
        WindowGroup {
            SampleRootView()
        }
    }
}

private struct SampleScreen {
    let label: String
    let screenID: String
    let file: String
}

private let sampleScreens: [SampleScreen] = [
    SampleScreen(label: "商品詳細", screenID: "product_detail", file: "product-detail"),
    SampleScreen(label: "通知設定", screenID: "settings_form", file: "settings-form"),
]

/// サンプル用の DocumentTransport。実アプリではここが実際の URLSession クライアントになる。
private struct BundleDocumentTransport: SpectreDocumentTransport {
    func fetch(screenId: String, params: [String: String], ifNoneMatch: String?) async -> SpectreDocumentTransportResult {
        guard let screen = sampleScreens.first(where: { $0.screenID == screenId }) else {
            return .failure(message: "未知の screenId: \(screenId)")
        }
        // ネットワーク往復の体感を出すための待ち (SampleHostDelegate と揃える)。
        try? await Task.sleep(nanoseconds: 600_000_000)
        guard let body = Self.readBundle(screen.file) else {
            return .failure(message: "\(screen.file).json がバンドルに見つかりません")
        }
        let etag = String(body.hashValue)
        if ifNoneMatch == etag { return .notModified }
        return .fresh(body: body, etag: etag, maxAgeSec: 60)
    }

    static func readBundle(_ name: String) -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "examples/screens")
            ?? Bundle.main.url(forResource: name, withExtension: "json") else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }
}

struct SampleRootView: View {
    @State private var selected = 0
    @State private var document: Document?
    @State private var loadError: String?
    @State private var loadSource: DocumentSource?
    @State private var eventLog: [String] = []
    // ディスク層はアプリのキャッシュディレクトリ配下。ホストアプリはここを完全に制御できる
    // (例: ログアウト時に消す、サイズ上限を設ける、など)。
    @State private var loader = DocumentLoader(
        transport: BundleDocumentTransport(),
        cacheDir: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("spectre-documents"),
        bundledProvider: { screenId in
            sampleScreens.first(where: { $0.screenID == screenId }).flatMap { BundleDocumentTransport.readBundle($0.file) }
        }
    )
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 画面切り替え。実アプリではサーバから screenId で引く部分。
                Picker("画面", selection: $selected) {
                    ForEach(Array(sampleScreens.enumerated()), id: \.offset) { index, screen in
                        Text(screen.label).tag(index)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)

                if let loadSource {
                    Text("読み込み元: \(String(describing: loadSource))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 12)
                }

                Group {
                    if let document {
                        SpectreScreen(
                            document: document,
                            host: host,
                            env: spectreEnvironment(appVersion: "1.0.0", colorScheme: colorScheme)
                        )
                        // ドキュメントが変わったら SpectreScreen を作り直す
                        .id(document.id)
                    } else if let loadError {
                        errorPanel(loadError)
                    } else {
                        ProgressView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // ドキュメントから発火した副作用の可視化。
                // 「ボタンを押すと何が起きたか」がその場で見えると理解が早い。
                eventLogPanel
            }
        }
        .onAppear(perform: reload)
        .onChange(of: selected) { _ in reload() }
    }

    /// ホストは画面を跨いで使い回す (エンドポイント登録やカウンタを保持するため)
    private var host: SampleHostDelegate {
        SampleHostStore.shared.delegate { line in
            Task { @MainActor in eventLog.insert(line, at: 0) }
        }
    }

    private func reload() {
        eventLog.removeAll()
        loadError = nil
        let screen = sampleScreens[selected]
        Task { @MainActor in
            for await result in loader.load(screenId: screen.screenID) {
                switch result {
                case .loaded(let doc, let source, _):
                    document = doc
                    loadSource = source
                    loadError = nil
                case .failed(let message):
                    if document == nil { loadError = message }
                }
            }
        }
    }

    private func errorPanel(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ドキュメントを読み込めませんでした").font(.headline)
            Text(message).font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var eventLogPanel: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("イベントログ (\(eventLog.count))").font(.caption.bold())
                Spacer()
                if !eventLog.isEmpty {
                    Button("消去") { eventLog.removeAll() }.font(.caption)
                }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    if eventLog.isEmpty {
                        Text("操作するとここに副作用が出ます")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(eventLog.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption2).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 120)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
    }
}

/// ホストデリゲートを1つだけ保持する。
/// SwiftUI の View は頻繁に再生成されるため、毎回作り直すと
/// エンドポイントの呼び出し回数などの状態が失われる。
final class SampleHostStore {
    static let shared = SampleHostStore()
    private var instance: SampleHostDelegate?

    func delegate(onEvent: @escaping (String) -> Void) -> SampleHostDelegate {
        if let instance { return instance }
        let created = SampleHostDelegate(onEvent: onEvent)
        instance = created
        return created
    }
}
