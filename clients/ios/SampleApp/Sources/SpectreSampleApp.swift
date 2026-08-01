import SwiftUI
import SpectreCore
import SpectreUI

/// サーバードリブン UI のサンプル。
///
/// サーバを立てる代わりに、examples/screens 以下の JSON をバンドルから読み込んで
/// そのまま描画する。配信経路が変わってもクライアント側の処理は同じで、
/// 「JSON を受け取って描画し、操作に反応する」ところを確認できる。
@main
struct SpectreSampleApp: App {
    var body: some Scene {
        WindowGroup {
            SampleRootView()
        }
    }
}

private let sampleScreens: [(label: String, file: String)] = [
    ("商品詳細", "product-detail"),
    ("通知設定", "settings-form"),
]

struct SampleRootView: View {
    @State private var selected = 0
    @State private var document: Document?
    @State private var loadError: String?
    @State private var eventLog: [String] = []
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

                Group {
                    if let loadError {
                        errorPanel(loadError)
                    } else if let document {
                        SpectreScreen(
                            document: document,
                            host: host,
                            env: spectreEnvironment(appVersion: "1.0.0", colorScheme: colorScheme)
                        )
                        // ドキュメントが変わったら SpectreScreen を作り直す
                        .id(document.id)
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
        document = nil

        let name = sampleScreens[selected].file
        guard let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "examples/screens")
            ?? Bundle.main.url(forResource: name, withExtension: "json") else {
            loadError = "\(name).json がバンドルに見つかりません"
            return
        }
        do {
            document = try DocumentParser.parse(text: try String(contentsOf: url, encoding: .utf8))
        } catch {
            loadError = String(describing: error)
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
