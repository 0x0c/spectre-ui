import SwiftUI
import SpectreCore
import SpectreUI

/// APNs ペイロードで配信された Spectre UI ドキュメントを描画するサンプル (SU-0012)。
///
/// examples/screens の JSON をバンドルから読む SU-0002 のサンプルとは対照的に、
/// ここではドキュメントがバンドルの外、リモート通知のペイロードから届く。
/// iOS シミュレータへ Payloads/*.apns をドラッグ&ドロップして試す。README.md を参照。
@main
struct APNsSampleApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            APNsRootView()
        }
    }
}

struct APNsRootView: View {
    @ObservedObject private var store = PushDocumentStore.shared
    @State private var eventLog: [String] = []
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Group {
                    if let document = store.document {
                        SpectreScreen(
                            document: document,
                            host: host,
                            env: spectreEnvironment(appVersion: "1.0.0", colorScheme: colorScheme)
                        )
                        // ドキュメントが変わったら SpectreScreen を作り直す
                        .id(document.id)
                    } else {
                        waitingPanel
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                eventLogPanel
            }
            .navigationTitle("Spectre APNs Sample")
        }
    }

    /// ホストは画面を跨いで使い回す (SampleHostStore と同じ理由)
    private var host: APNsSampleHostDelegate {
        APNsSampleHostStore.shared.delegate { line in
            Task { @MainActor in eventLog.insert(line, at: 0) }
        }
    }

    private var waitingPanel: some View {
        VStack(spacing: 12) {
            Image(systemName: "bell.badge")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("通知の到着を待っています").font(.headline)
            Text("Payloads/*.apns をシミュレータへドラッグ&ドロップしてください")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let loadError = store.loadError {
                Text(loadError)
                    .font(.caption2)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(32)
    }

    private var eventLogPanel: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("受信したペイロード \(store.receivedCount) 件 / イベントログ \(eventLog.count) 件").font(.caption.bold())
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

/// ホストデリゲートを1つだけ保持する。SwiftUI の View は頻繁に再生成されるため、
/// 毎回作り直すとイベントログの参照が失われる。
final class APNsSampleHostStore {
    static let shared = APNsSampleHostStore()
    private var instance: APNsSampleHostDelegate?

    func delegate(onEvent: @escaping (String) -> Void) -> APNsSampleHostDelegate {
        if let instance { return instance }
        let created = APNsSampleHostDelegate(onEvent: onEvent)
        instance = created
        return created
    }
}
