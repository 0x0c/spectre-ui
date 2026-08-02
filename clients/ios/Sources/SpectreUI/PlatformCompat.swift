import SwiftUI

/// iOS 専用 API の薄い互換レイヤ。
///
/// SpectreUI の対象は iOS だが、macOS でもコンパイルが通るようにしてある。
/// 理由は CI — SpectreCore の適合性テストを macOS ホストの `swift test` で
/// 走らせるとき、SwiftPM が同じパッケージ内の SpectreUI もビルド対象に
/// 引き込むことがあるため。ここで吸収しておかないと、
/// 「ロジックのテストが UI のプラットフォーム差で落ちる」ことになる。
///
/// 実際の見た目は iOS でしか使わないので、macOS 側は妥当な近似で足りる。
extension Color {
    static var spectreBackground: Color {
        #if os(iOS)
        Color(.systemBackground)
        #else
        Color(nsColor: .windowBackgroundColor)
        #endif
    }

    static var spectreSurface: Color {
        #if os(iOS)
        Color(.secondarySystemBackground)
        #else
        Color(nsColor: .controlBackgroundColor)
        #endif
    }

    static var spectreSurfaceVariant: Color {
        #if os(iOS)
        Color(.tertiarySystemBackground)
        #else
        Color(nsColor: .underPageBackgroundColor)
        #endif
    }

    static var spectreFill: Color {
        #if os(iOS)
        Color(.tertiarySystemFill)
        #else
        Color(nsColor: .quaternaryLabelColor)
        #endif
    }

    static var spectreSeparator: Color {
        #if os(iOS)
        Color(.separator)
        #else
        Color(nsColor: .separatorColor)
        #endif
    }
}

extension View {
    /// ナビゲーションバーのタイトル表示形式。macOS には該当する指定がない。
    @ViewBuilder
    func spectreInlineNavigationTitle() -> some View {
        #if os(iOS)
        self.navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }
}

/// ツールバーの配置。iOS は右上、macOS は primaryAction に寄せる。
var spectreToolbarTrailingPlacement: ToolbarItemPlacement {
    #if os(iOS)
    .topBarTrailing
    #else
    .primaryAction
    #endif
}

extension View {
    /// 全画面モーダル。macOS に `fullScreenCover` はないので、シートで代用する
    /// (docs/spec/schema.md §3.1 の `style: "fullScreen"`)。
    @ViewBuilder
    func spectreFullScreenCover<Content: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        #if os(iOS)
        self.fullScreenCover(isPresented: isPresented, content: content)
        #else
        self.sheet(isPresented: isPresented, content: content)
        #endif
    }
}

extension View {
    /// シートの高さ。`nil` を渡した場合は指定しない (全画面・ダイアログ形式)。
    @ViewBuilder
    func spectreDetents(_ detents: Set<PresentationDetent>?) -> some View {
        if let detents {
            self.presentationDetents(detents)
        } else {
            self
        }
    }
}
