// 自動生成 — 直接編集しないこと。
// 生成元: spec/component-manifest.json (manifestVersion 0.1.0)
// 再生成: node packages/codegen/generate.mjs
import Foundation

/// マニフェスト由来のコンポーネント定義。
public struct ComponentSpec: Sendable {
    public let name: String
    public let acceptsChildren: Bool
    /// 既知のトップレベルプロパティ名。ここにないキーは解決時に捨てられる。
    public let propNames: Set<String>
    /// 解決せず生のまま保持するパス (アクション)。
    public let actionPaths: [String]
    /// 子ノードとして解決するパス。配列は末尾が "[]"。
    public let nodePaths: [String]
}

/// このクライアントが解釈できるコンポーネントの集合。
public enum GeneratedCatalog {

    public static let schemaVersion = "1.0"
    public static let manifestVersion = "0.1.0"

    public static let components: [ComponentSpec] = [
        ComponentSpec(
            name: "Screen",
            acceptsChildren: true,
            propNames: ["background", "scrollable", "safeArea", "appBar", "bottomBar"],
            actionPaths: [],
            nodePaths: ["appBar.actions[]", "bottomBar"]
        ),
        ComponentSpec(
            name: "VStack",
            acceptsChildren: true,
            propNames: ["spacing", "alignment", "distribution"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "HStack",
            acceptsChildren: true,
            propNames: ["spacing", "alignment", "distribution", "wrap"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "ZStack",
            acceptsChildren: true,
            propNames: ["alignment"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Spacer",
            acceptsChildren: false,
            propNames: ["minLength"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Divider",
            acceptsChildren: false,
            propNames: ["orientation", "inset", "color"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "ScrollView",
            acceptsChildren: true,
            propNames: ["direction", "showsIndicator"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "List",
            acceptsChildren: true,
            propNames: ["spacing", "separator", "header", "footer"],
            actionPaths: [],
            nodePaths: ["header", "footer"]
        ),
        ComponentSpec(
            name: "Grid",
            acceptsChildren: true,
            propNames: ["columns", "spacing"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Card",
            acceptsChildren: true,
            propNames: ["padding", "elevation", "radius", "onTap"],
            actionPaths: ["onTap"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Section",
            acceptsChildren: true,
            propNames: ["title", "subtitle", "action"],
            actionPaths: ["action.actions"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Tabs",
            acceptsChildren: true,
            propNames: ["items", "selectedId", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Text",
            acceptsChildren: false,
            propNames: ["text", "typography", "color", "align", "weight", "maxLines", "truncation", "decoration", "selectable"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Image",
            acceptsChildren: false,
            propNames: ["url", "contentMode", "aspectRatio", "radius", "placeholder", "decorative"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Icon",
            acceptsChildren: false,
            propNames: ["name", "size", "color"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Badge",
            acceptsChildren: false,
            propNames: ["text", "tone", "variant"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "ProgressIndicator",
            acceptsChildren: false,
            propNames: ["kind", "value", "size"],
            actionPaths: [],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Button",
            acceptsChildren: false,
            propNames: ["label", "variant", "size", "leadingIcon", "trailingIcon", "enabled", "loading", "onTap"],
            actionPaths: ["onTap"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "TextField",
            acceptsChildren: false,
            propNames: ["bindTo", "label", "placeholder", "helperText", "errorText", "keyboard", "multiline", "maxLength", "validation", "debounceMs", "onChange", "onSubmit"],
            actionPaths: ["onChange", "onSubmit"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Toggle",
            acceptsChildren: false,
            propNames: ["bindTo", "label", "enabled", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Checkbox",
            acceptsChildren: false,
            propNames: ["bindTo", "label", "enabled", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "RadioGroup",
            acceptsChildren: false,
            propNames: ["bindTo", "options", "orientation", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Select",
            acceptsChildren: false,
            propNames: ["bindTo", "options", "label", "placeholder", "searchable", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Slider",
            acceptsChildren: false,
            propNames: ["bindTo", "min", "max", "step", "showValue", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "Stepper",
            acceptsChildren: false,
            propNames: ["bindTo", "min", "max", "step", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
        ComponentSpec(
            name: "DatePicker",
            acceptsChildren: false,
            propNames: ["bindTo", "mode", "label", "min", "max", "displayFormat", "onChange"],
            actionPaths: ["onChange"],
            nodePaths: []
        ),
    ]

    private static let byName: [String: ComponentSpec] =
        Dictionary(uniqueKeysWithValues: components.map { ($0.name, $0) })

    public static func spec(_ type: String) -> ComponentSpec? { byName[type] }

    public static func supports(_ type: String) -> Bool { byName[type] != nil }

    public static var componentNames: Set<String> { Set(byName.keys) }

    public static let actionNames: Set<String> = ["setState", "toggleState", "request", "navigate", "back", "dismiss", "showOverlay", "dismissOverlay", "openUrl", "refresh", "applyPatch", "host", "track", "sequence", "condition", "delay", "focus", "scrollTo"]

    /// 対応コンポーネント集合のハッシュ。Kotlin 実装と同じ FNV-1a で計算する。
    public static func capabilityHash(supported: Set<String>? = nil) -> String {
        var hash: Int32 = Int32(bitPattern: 0x811c9dc5)
        for name in (supported ?? componentNames).sorted() {
            for scalar in name.unicodeScalars {
                hash ^= Int32(bitPattern: UInt32(scalar.value))
                hash = hash &* 0x01000193
            }
        }
        return String(format: "%08x", UInt32(bitPattern: hash))
    }
}

/// マニフェストの limits。クライアント側でも強制する。
public enum SpectreLimits {
    public static let maxNodes = 2000
    public static let maxDepth = 32
    public static let maxDocumentBytes = 1048576
    public static let maxExprASTNodes = 256
    public static let maxExprDepth = 32
    public static let maxRepeatItems = 500
    public static let maxActionsPerDispatch = 64
    public static let maxActionNesting = 8
}
