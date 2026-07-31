// 自動生成 — 直接編集しないこと。
// 生成元: spec/component-manifest.json (manifestVersion 0.1.0)
// 再生成: node packages/codegen/generate.mjs
package dev.spectre.core

/** マニフェスト由来のコンポーネント定義。 */
data class ComponentSpec(
    val name: String,
    val acceptsChildren: Boolean,
    /** 既知のトップレベルプロパティ名。ここにないキーは解決時に捨てられる。 */
    val propNames: Set<String>,
    /** 解決せず生のまま保持するパス (アクション)。 */
    val actionPaths: List<String>,
    /** 子ノードとして解決するパス。配列は末尾が "[]"。 */
    val nodePaths: List<String>,
)

/**
 * このクライアントが解釈できるコンポーネントの集合。
 *
 * サーバへのケイパビリティ申告 ([capabilityHash]) と、未知コンポーネントの
 * 劣化判定に使う (docs/compatibility.md §2)。
 */
object GeneratedCatalog {

    const val SCHEMA_VERSION: String = "1.0"
    const val MANIFEST_VERSION: String = "0.1.0"

    val components: List<ComponentSpec> = listOf(
        ComponentSpec(
            name = "Screen",
            acceptsChildren = true,
            propNames = setOf("background", "scrollable", "safeArea", "appBar", "bottomBar"),
            actionPaths = listOf(),
            nodePaths = listOf("appBar.actions[]", "bottomBar"),
        ),
        ComponentSpec(
            name = "VStack",
            acceptsChildren = true,
            propNames = setOf("spacing", "alignment", "distribution"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "HStack",
            acceptsChildren = true,
            propNames = setOf("spacing", "alignment", "distribution", "wrap"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "ZStack",
            acceptsChildren = true,
            propNames = setOf("alignment"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Spacer",
            acceptsChildren = false,
            propNames = setOf("minLength"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Divider",
            acceptsChildren = false,
            propNames = setOf("orientation", "inset", "color"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "ScrollView",
            acceptsChildren = true,
            propNames = setOf("direction", "showsIndicator"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "List",
            acceptsChildren = true,
            propNames = setOf("spacing", "separator", "header", "footer"),
            actionPaths = listOf(),
            nodePaths = listOf("header", "footer"),
        ),
        ComponentSpec(
            name = "Grid",
            acceptsChildren = true,
            propNames = setOf("columns", "spacing"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Card",
            acceptsChildren = true,
            propNames = setOf("padding", "elevation", "radius", "onTap"),
            actionPaths = listOf("onTap"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Section",
            acceptsChildren = true,
            propNames = setOf("title", "subtitle", "action"),
            actionPaths = listOf("action.actions"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Tabs",
            acceptsChildren = true,
            propNames = setOf("items", "selectedId", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Text",
            acceptsChildren = false,
            propNames = setOf("text", "typography", "color", "align", "weight", "maxLines", "truncation", "decoration", "selectable"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Image",
            acceptsChildren = false,
            propNames = setOf("url", "contentMode", "aspectRatio", "radius", "placeholder", "decorative"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Icon",
            acceptsChildren = false,
            propNames = setOf("name", "size", "color"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Badge",
            acceptsChildren = false,
            propNames = setOf("text", "tone", "variant"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "ProgressIndicator",
            acceptsChildren = false,
            propNames = setOf("kind", "value", "size"),
            actionPaths = listOf(),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Button",
            acceptsChildren = false,
            propNames = setOf("label", "variant", "size", "leadingIcon", "trailingIcon", "enabled", "loading", "onTap"),
            actionPaths = listOf("onTap"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "TextField",
            acceptsChildren = false,
            propNames = setOf("bindTo", "label", "placeholder", "helperText", "errorText", "keyboard", "multiline", "maxLength", "validation", "debounceMs", "onChange", "onSubmit"),
            actionPaths = listOf("onChange", "onSubmit"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Toggle",
            acceptsChildren = false,
            propNames = setOf("bindTo", "label", "enabled", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Checkbox",
            acceptsChildren = false,
            propNames = setOf("bindTo", "label", "enabled", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "RadioGroup",
            acceptsChildren = false,
            propNames = setOf("bindTo", "options", "orientation", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Select",
            acceptsChildren = false,
            propNames = setOf("bindTo", "options", "label", "placeholder", "searchable", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Slider",
            acceptsChildren = false,
            propNames = setOf("bindTo", "min", "max", "step", "showValue", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "Stepper",
            acceptsChildren = false,
            propNames = setOf("bindTo", "min", "max", "step", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
        ComponentSpec(
            name = "DatePicker",
            acceptsChildren = false,
            propNames = setOf("bindTo", "mode", "label", "min", "max", "displayFormat", "onChange"),
            actionPaths = listOf("onChange"),
            nodePaths = listOf(),
        ),
    )

    private val byName: Map<String, ComponentSpec> = components.associateBy { it.name }

    fun spec(type: String): ComponentSpec? = byName[type]

    fun supports(type: String): Boolean = byName.containsKey(type)

    val componentNames: Set<String> = byName.keys

    val actionNames: Set<String> = setOf("setState", "toggleState", "request", "navigate", "back", "dismiss", "showOverlay", "dismissOverlay", "openUrl", "refresh", "applyPatch", "host", "track", "sequence", "condition", "delay", "focus", "scrollTo")

    /**
     * 対応コンポーネント集合のハッシュ。SDK バージョンとは独立に持つ
     * (ホストアプリがコンポーネントを部分的に無効化できるため)。
     */
    fun capabilityHash(supported: Set<String> = componentNames): String {
        var hash = 0x811c9dc5.toInt()
        for (name in supported.sorted()) {
            for (ch in name) {
                hash = hash xor ch.code
                hash *= 0x01000193
            }
        }
        return String.format("%08x", hash)
    }
}

/** マニフェストの limits。クライアント側でも強制する (docs/architecture.md §5)。 */
object SpectreLimits {
    const val MAX_NODES: Int = 2000
    const val MAX_DEPTH: Int = 32
    const val MAX_DOCUMENT_BYTES: Int = 1048576
    const val MAX_EXPR_AST_NODES: Int = 256
    const val MAX_EXPR_DEPTH: Int = 32
    const val MAX_REPEAT_ITEMS: Int = 500
    const val MAX_ACTIONS_PER_DISPATCH: Int = 64
    const val MAX_ACTION_NESTING: Int = 8
}
