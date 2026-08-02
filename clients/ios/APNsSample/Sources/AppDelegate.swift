import UIKit
import UserNotifications

/// 通知許可の要求とデリゲートの配線 (SU-0012 の詳細設計 §2)。
///
/// アプリがフォアグラウンドにあるときに届いたペイロードは `willPresent` で、
/// 通知バナーのタップで届いたペイロードは `didReceive response:` で受け取る。
/// どちらの経路でも `userInfo` を `PushDocumentStore` に渡すだけで、
/// パースと描画は既存のランタイムに委ねる。
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        Task { @MainActor in
            PushDocumentStore.shared.handle(userInfo: notification.request.content.userInfo)
        }
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task { @MainActor in
            PushDocumentStore.shared.handle(userInfo: response.notification.request.content.userInfo)
            completionHandler()
        }
    }
}
