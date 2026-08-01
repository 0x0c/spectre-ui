import SwiftUI
import SpectreCore

/// 解決済みノードからの型付き取り出し。
///
/// 値が期待した型でない場合は既定値に落とす。ここで例外を投げると
/// 「壊れたドキュメントでアプリが落ちる」ことになるため、必ず値を返す。
public extension RenderNode {

    /// 文字列プロパティ。
    ///
    /// 数値や真偽値が来ても文字列化する。`"${item}"` のように式が単独で書かれた場合は
    /// 型が保存されて数値のまま解決されるため、文字列化はここが担当する
    /// (docs/spec/expression.md §1)。
    func string(_ name: String, default fallback: String = "") -> String {
        guard let value = props[name], !value.isNull else { return fallback }
        return value.stringify()
    }

    func stringOrNil(_ name: String) -> String? {
        guard let value = props[name], !value.isNull else { return nil }
        return value.stringify()
    }

    func bool(_ name: String, default fallback: Bool) -> Bool {
        guard let value = props[name], !value.isNull else { return fallback }
        return value.isTruthy
    }

    func int(_ name: String, default fallback: Int) -> Int {
        props[name]?.asInt ?? fallback
    }

    func intOrNil(_ name: String) -> Int? { props[name]?.asInt }

    func double(_ name: String, default fallback: Double) -> Double {
        props[name]?.asDouble ?? fallback
    }

    func doubleOrNil(_ name: String) -> Double? { props[name]?.asDouble }

    func token(_ name: String, default fallback: String) -> String {
        props[name]?.asString ?? fallback
    }

    func tokenOrNil(_ name: String) -> String? { props[name]?.asString }

    /// `{value, label, enabled}` の配列を取り出す。
    func options(_ name: String) -> [SpectreOption] {
        (props[name]?.asArray ?? []).compactMap { item in
            guard let value = item["value"]?.stringify() else { return nil }
            return SpectreOption(
                value: value,
                label: item["label"]?.stringify() ?? value,
                enabled: item["enabled"]?.isTruthy ?? true
            )
        }
    }

    /// Tabs の `items`。
    func tabItems() -> [SpectreTabItem] {
        (props["items"]?.asArray ?? []).compactMap { item in
            guard let id = item["id"]?.stringify() else { return nil }
            return SpectreTabItem(
                id: id,
                label: item["label"]?.stringify() ?? id,
                icon: item["icon"]?.asString,
                badge: item["badge"]?.asString
            )
        }
    }

    /// a11y のラベル。装飾扱いのノードは nil を返してスクリーンリーダから隠す。
    func a11yLabel() -> String? {
        if a11y["hidden"]?.isTruthy == true { return nil }
        guard let value = a11y["label"], !value.isNull else { return nil }
        return value.stringify()
    }

    func a11yHidden() -> Bool { a11y["hidden"]?.isTruthy == true }
}

public struct SpectreOption: Identifiable, Hashable {
    public let value: String
    public let label: String
    public let enabled: Bool
    public var id: String { value }
}

public struct SpectreTabItem: Identifiable, Hashable {
    public let id: String
    public let label: String
    public let icon: String?
    public let badge: String?
}

// MARK: - 列挙値の写像

func textAlignmentOf(_ token: String) -> TextAlignment {
    switch token {
    case "center": return .center
    case "end": return .trailing
    default: return .leading
    }
}

func frameAlignmentOf(_ token: String) -> Alignment {
    switch token {
    case "center": return .center
    case "end": return .trailing
    default: return .leading
    }
}

func fontWeightOf(_ token: String) -> Font.Weight? {
    switch token {
    case "medium": return .medium
    case "bold": return .bold
    default: return nil
    }
}

func contentModeOf(_ token: String) -> ContentMode {
    token == "fit" ? .fit : .fill
}

func horizontalAlignmentOf(_ token: String) -> HorizontalAlignment {
    switch token {
    case "center": return .center
    case "trailing": return .trailing
    default: return .leading
    }
}

func verticalAlignmentOf(_ token: String) -> VerticalAlignment {
    switch token {
    case "top": return .top
    case "bottom": return .bottom
    case "baseline": return .firstTextBaseline
    default: return .center
    }
}

func stackAlignmentOf(_ token: String) -> Alignment {
    switch token {
    case "topLeading": return .topLeading
    case "top": return .top
    case "topTrailing": return .topTrailing
    case "leading": return .leading
    case "trailing": return .trailing
    case "bottomLeading": return .bottomLeading
    case "bottom": return .bottom
    case "bottomTrailing": return .bottomTrailing
    default: return .center
    }
}
