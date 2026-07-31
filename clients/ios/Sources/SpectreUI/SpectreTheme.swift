import SwiftUI

/// トークン名 -> 実際の色・書体・寸法の対応表。
///
/// SDK はトークン名しか知らない。実体をホストアプリが注入することで、
/// ホストのデザインシステムにそのまま馴染み、ダークモードや Dynamic Type も
/// ホスト側の仕組みに乗る (docs/architecture.md §6)。
public struct SpectreTheme {
    public var colors: [String: Color]
    public var fonts: [String: Font]
    public var spacing: [String: CGFloat]
    public var radius: [String: CGFloat]
    public var icons: [String: String]

    public init(
        colors: [String: Color] = SpectreTheme.defaultColors,
        fonts: [String: Font] = SpectreTheme.defaultFonts,
        spacing: [String: CGFloat] = SpectreTheme.defaultSpacing,
        radius: [String: CGFloat] = SpectreTheme.defaultRadius,
        icons: [String: String] = SpectreTheme.defaultIcons
    ) {
        self.colors = colors
        self.fonts = fonts
        self.spacing = spacing
        self.radius = radius
        self.icons = icons
    }

    public func color(_ token: String?, default fallback: Color = .primary) -> Color {
        guard let token, let color = colors[token] else { return fallback }
        return color
    }

    public func font(_ token: String?) -> Font {
        guard let token, let font = fonts[token] else { return .body }
        return font
    }

    public func space(_ token: String?) -> CGFloat {
        guard let token, let value = spacing[token] else { return 0 }
        return value
    }

    public func corner(_ token: String?) -> CGFloat {
        guard let token, let value = radius[token] else { return 0 }
        return value
    }

    /// 未知のアイコン名は情報アイコンに落とす。描画が欠けるよりは何か出したほうがよい。
    public func symbol(_ token: String?) -> String {
        guard let token, let name = icons[token] else { return "info.circle" }
        return name
    }

    /// spec/component-manifest.json の tokens.color と対応。
    /// Material3 の役割名を SwiftUI の意味色に写している。
    public static let defaultColors: [String: Color] = [
        "primary": .accentColor,
        "onPrimary": .white,
        "primaryContainer": Color.accentColor.opacity(0.15),
        "onPrimaryContainer": .accentColor,
        "secondary": .secondary,
        "onSecondary": .white,
        "secondaryContainer": Color.secondary.opacity(0.15),
        "onSecondaryContainer": .secondary,
        "surface": Color(.secondarySystemBackground),
        "onSurface": .primary,
        "surfaceVariant": Color(.tertiarySystemBackground),
        "onSurfaceVariant": .secondary,
        "background": Color(.systemBackground),
        "onBackground": .primary,
        "outline": Color(.separator),
        "outlineVariant": Color(.separator).opacity(0.5),
        "error": .red,
        "onError": .white,
        "success": .green,
        "onSuccess": .white,
        "warning": .orange,
        "onWarning": .black,
        "info": .blue,
        "onInfo": .white,
        "transparent": .clear,
    ]

    /// 実サイズを固定せず Dynamic Type に追従させる。
    /// 固定 pt を許さないのはフォントスケール設定に耐えるため。
    public static let defaultFonts: [String: Font] = [
        "displayLg": .largeTitle,
        "displayMd": .title,
        "titleLg": .title2,
        "titleMd": .title3,
        "titleSm": .headline,
        "bodyLg": .body,
        "bodyMd": .body,
        "bodySm": .subheadline,
        "label": .callout,
        "caption": .caption,
        "overline": .caption2,
    ]

    public static let defaultSpacing: [String: CGFloat] = [
        "none": 0, "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "xxl": 48,
    ]

    /// `full` は完全な丸み。実際の描画では十分大きい値として扱う。
    public static let defaultRadius: [String: CGFloat] = [
        "none": 0, "sm": 4, "md": 8, "lg": 16, "xl": 24, "full": 999,
    ]

    /// IconToken -> SF Symbols。
    ///
    /// SF Symbols と Material Symbols は名前も字形も一致しないため、Spectre 独自の
    /// アイコン名前空間を定義し、プラットフォームごとに対応表を持つ
    /// (docs/spec/components.md)。Android 側の `SpectreDefaultIcons` と対になる。
    public static let defaultIcons: [String: String] = [
        "chevron.right": "chevron.right",
        "chevron.left": "chevron.left",
        "chevron.up": "chevron.up",
        "chevron.down": "chevron.down",
        "arrow.back": "arrow.left",
        "arrow.forward": "arrow.right",
        "close": "xmark",
        "clear": "xmark.circle.fill",
        "check": "checkmark",
        "plus": "plus",
        "minus": "minus",
        "search": "magnifyingglass",
        "filter": "line.3.horizontal.decrease",
        "sort": "arrow.up.arrow.down",
        "list": "list.bullet",
        "menu": "line.3.horizontal",
        "heart": "heart",
        "heart.fill": "heart.fill",
        "star": "star",
        "star.fill": "star.fill",
        "share": "square.and.arrow.up",
        "cart": "cart",
        "user": "person",
        "home": "house",
        "info": "info.circle",
        "warning": "exclamationmark.triangle",
        "error": "xmark.octagon",
        "success": "checkmark.circle",
        "lock": "lock",
        "calendar": "calendar",
        "clock": "clock",
        "location": "mappin.and.ellipse",
        "mail": "envelope",
        "bell": "bell",
        "settings": "gearshape",
        "refresh": "arrow.clockwise",
        "trash": "trash",
        "edit": "pencil",
        "camera": "camera",
        "image": "photo",
        "more.vertical": "ellipsis",
        "more.horizontal": "ellipsis",
    ]
}

private struct SpectreThemeKey: EnvironmentKey {
    static let defaultValue = SpectreTheme()
}

public extension EnvironmentValues {
    var spectreTheme: SpectreTheme {
        get { self[SpectreThemeKey.self] }
        set { self[SpectreThemeKey.self] = newValue }
    }
}
