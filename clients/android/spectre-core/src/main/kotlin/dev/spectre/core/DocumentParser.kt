package dev.spectre.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * JSON テキスト -> [Document]。
 *
 * ここでの責務は3つ。
 * 1. 構造の解釈 (ノード木・オーバレイ・アクション)
 * 2. マニフェスト由来の分類に従ったプロパティの振り分け (props / rawProps / nodeProps)
 * 3. 上限値の強制 — 不正なドキュメントを描画層に渡さない (docs/architecture.md §5)
 *
 * 未知のコンポーネント型はここでは弾かない。劣化の判断は [Resolver] が
 * ケイパビリティに基づいて行うため、パース段階では素通しする。
 */
object DocumentParser {

    private val json = Json { ignoreUnknownKeys = true; isLenient = false }

    class ParseException(message: String) : Exception(message)

    fun parse(text: String): Document {
        if (text.toByteArray(Charsets.UTF_8).size > SpectreLimits.MAX_DOCUMENT_BYTES) {
            throw ParseException("ドキュメントが上限 ${SpectreLimits.MAX_DOCUMENT_BYTES} バイトを超えています")
        }
        val root = runCatching { json.parseToJsonElement(text) }
            .getOrElse { throw ParseException("JSON として解析できません: ${it.message}") }
        val obj = root as? JsonObject ?: throw ParseException("ドキュメントのトップレベルはオブジェクトです")
        return parse(obj.toSpValue() as SpValue.Obj)
    }

    fun parse(value: SpValue.Obj): Document {
        val schemaVersion = value.entries["schemaVersion"]?.asStringOrNull
            ?: throw ParseException("schemaVersion がありません")
        val id = value.entries["id"]?.asStringOrNull
            ?: throw ParseException("id がありません")
        val rootValue = value.entries["root"] as? SpValue.Obj
            ?: throw ParseException("root がありません")

        val counter = NodeCounter()
        val root = parseNode(rootValue, counter, depth = 1)

        return Document(
            schemaVersion = schemaVersion,
            id = id,
            version = value.entries["version"]?.asStringOrNull,
            meta = parseMeta(value.entries["meta"] as? SpValue.Obj),
            data = value.entries["data"] as? SpValue.Obj ?: SpValue.EmptyObj,
            state = value.entries["state"] as? SpValue.Obj ?: SpValue.EmptyObj,
            root = root,
            overlays = (value.entries["overlays"] as? SpValue.Arr)?.items
                ?.mapNotNull { (it as? SpValue.Obj)?.let { o -> parseOverlay(o, counter) } }
                ?: emptyList(),
            onAppear = actionList(value.entries["onAppear"]),
            onDisappear = actionList(value.entries["onDisappear"]),
        )
    }

    private fun parseMeta(value: SpValue.Obj?): DocumentMeta {
        if (value == null) return DocumentMeta()
        val refresh = value.entries["refresh"] as? SpValue.Obj
        return DocumentMeta(
            title = value.entries["title"]?.asStringOrNull,
            statePolicy = if (value.entries["statePolicy"]?.asStringOrNull == "preserve") {
                StatePolicy.PRESERVE
            } else {
                StatePolicy.RESET
            },
            pullToRefresh = refresh?.entries?.get("pullToRefresh")?.asBoolOrNull ?: false,
            refreshIntervalSec = refresh?.entries?.get("intervalSec")?.asIntOrNull,
        )
    }

    private class NodeCounter {
        var count = 0
        fun tick() {
            count++
            if (count > SpectreLimits.MAX_NODES) {
                throw ParseException("ノード数が上限 ${SpectreLimits.MAX_NODES} を超えています")
            }
        }
    }

    private fun parseNode(value: SpValue.Obj, counter: NodeCounter, depth: Int): Node {
        counter.tick()
        if (depth > SpectreLimits.MAX_DEPTH) {
            throw ParseException("ノードの深さが上限 ${SpectreLimits.MAX_DEPTH} を超えています")
        }

        val type = value.entries["type"]?.asStringOrNull
            ?: throw ParseException("ノードに type がありません")
        val spec = GeneratedCatalog.spec(type)

        val rawPropsObject = value.entries["props"] as? SpValue.Obj ?: SpValue.EmptyObj
        val split = splitProps(rawPropsObject, spec, counter, depth)

        return Node(
            type = type,
            id = value.entries["id"]?.asStringOrNull,
            props = split.props,
            rawProps = split.rawProps,
            nodeProps = split.nodeProps,
            children = (value.entries["children"] as? SpValue.Arr)?.items
                ?.mapNotNull { it as? SpValue.Obj }
                ?.map { parseNode(it, counter, depth + 1) }
                ?: emptyList(),
            layout = (value.entries["layout"] as? SpValue.Obj)?.entries ?: emptyMap(),
            style = (value.entries["style"] as? SpValue.Obj)?.entries ?: emptyMap(),
            a11y = (value.entries["a11y"] as? SpValue.Obj)?.entries ?: emptyMap(),
            visibleWhen = value.entries["visibleWhen"]?.asStringOrNull,
            repeat = (value.entries["repeat"] as? SpValue.Obj)?.let { parseRepeat(it, counter, depth) },
            fallback = (value.entries["fallback"] as? SpValue.Obj)?.let { parseNode(it, counter, depth) },
            optional = value.entries["optional"]?.asBoolOrNull ?: false,
        )
    }

    private fun parseRepeat(value: SpValue.Obj, counter: NodeCounter, depth: Int): RepeatSpec? {
        val forExpression = value.entries["for"]?.asStringOrNull ?: return null
        return RepeatSpec(
            forExpression = forExpression,
            asName = value.entries["as"]?.asStringOrNull ?: "item",
            indexName = value.entries["indexAs"]?.asStringOrNull ?: "index",
            key = value.entries["key"]?.asStringOrNull,
            limit = value.entries["limit"]?.asIntOrNull,
            emptyView = (value.entries["emptyView"] as? SpValue.Obj)?.let { parseNode(it, counter, depth + 1) },
        )
    }

    private fun parseOverlay(value: SpValue.Obj, counter: NodeCounter): Overlay? {
        val id = value.entries["id"]?.asStringOrNull ?: return null
        val kind = when (value.entries["kind"]?.asStringOrNull) {
            "sheet" -> OverlayKind.SHEET
            "alert" -> OverlayKind.ALERT
            "toast" -> OverlayKind.TOAST
            else -> return null
        }
        val reserved = setOf("id", "kind", "root", "buttons")
        return Overlay(
            id = id,
            kind = kind,
            props = value.entries.filterKeys { it !in reserved },
            root = (value.entries["root"] as? SpValue.Obj)?.let { parseNode(it, counter, depth = 1) },
            buttons = (value.entries["buttons"] as? SpValue.Arr)?.items
                ?.mapNotNull { it as? SpValue.Obj }
                ?.mapNotNull { button ->
                    val label = button.entries["label"]?.asStringOrNull ?: return@mapNotNull null
                    OverlayButton(
                        label = label,
                        role = button.entries["role"]?.asStringOrNull ?: "default",
                        actions = actionList(button.entries["actions"]),
                    )
                }
                ?: emptyList(),
        )
    }

    private fun actionList(value: SpValue?): List<SpValue> =
        (value as? SpValue.Arr)?.items ?: emptyList()

    // -- プロパティの振り分け -------------------------------------------------

    private class SplitProps(
        val props: Map<String, SpValue>,
        val rawProps: Map<String, SpValue>,
        val nodeProps: Map<String, List<Node>>,
    )

    /**
     * マニフェスト由来の分類 ([ComponentSpec]) に従ってプロパティを3つに分ける。
     *
     * 未知のコンポーネント (spec == null) では振り分けができないので、すべてを
     * [Node.props] に残す。未知ノードは [Resolver] が fallback へ置換するため、
     * ここで捨ててしまうと fallback の解決に必要な情報まで失われる。
     */
    private fun splitProps(
        source: SpValue.Obj,
        spec: ComponentSpec?,
        counter: NodeCounter,
        depth: Int,
    ): SplitProps {
        if (spec == null) return SplitProps(source.entries, emptyMap(), emptyMap())

        var remaining: SpValue = SpValue.Obj(
            // 未知のプロパティキーは黙って無視する (docs/compatibility.md §3)
            source.entries.filterKeys { it in spec.propNames }
        )
        val rawProps = LinkedHashMap<String, SpValue>()
        val nodeProps = LinkedHashMap<String, List<Node>>()

        for (path in spec.actionPaths) {
            val (rest, extracted) = takePath(remaining, PathSpec.parse(path))
            remaining = rest
            if (extracted != null) rawProps[path] = extracted
        }

        for (path in spec.nodePaths) {
            val pathSpec = PathSpec.parse(path)
            val (rest, extracted) = takePath(remaining, pathSpec)
            remaining = rest
            if (extracted == null) continue
            val nodes = if (pathSpec.isArray) {
                (extracted as? SpValue.Arr)?.items
                    ?.mapNotNull { it as? SpValue.Obj }
                    ?.map { parseNode(it, counter, depth + 1) }
                    ?: emptyList()
            } else {
                (extracted as? SpValue.Obj)?.let { listOf(parseNode(it, counter, depth + 1)) } ?: emptyList()
            }
            if (nodes.isNotEmpty()) nodeProps[path] = nodes
        }

        return SplitProps((remaining as? SpValue.Obj)?.entries ?: emptyMap(), rawProps, nodeProps)
    }

    private class PathSpec(val segments: List<String>, val isArray: Boolean) {
        companion object {
            fun parse(path: String): PathSpec {
                val isArray = path.endsWith("[]")
                val clean = if (isArray) path.dropLast(2) else path
                return PathSpec(clean.split('.'), isArray)
            }
        }
    }

    /**
     * ドット区切りのパスにある値を取り出し、「取り出した値」と「残りの構造」を返す。
     *
     * `Screen.appBar` のようにオブジェクトの内側にノードがある場合、appBar 自体は
     * props に残しつつ appBar.actions だけを nodeProps へ移す必要があるため、
     * 単純な削除ではなく分離になっている。
     */
    private fun takePath(container: SpValue, spec: PathSpec): Pair<SpValue, SpValue?> =
        takeSegments(container, spec.segments, 0)

    private fun takeSegments(container: SpValue, segments: List<String>, index: Int): Pair<SpValue, SpValue?> {
        if (index >= segments.size) return SpValue.Null to container
        val obj = container as? SpValue.Obj ?: return container to null
        val key = segments[index]
        val child = obj.entries[key] ?: return container to null

        val (childRemaining, extracted) = takeSegments(child, segments, index + 1)
        if (extracted == null) return container to null

        val newEntries = LinkedHashMap(obj.entries)
        if (childRemaining is SpValue.Null) newEntries.remove(key) else newEntries[key] = childRemaining
        return SpValue.Obj(newEntries) to extracted
    }
}
