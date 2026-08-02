package dev.spectre.core

/**
 * 未解決のドキュメント。式文字列をそのまま保持している。
 * 描画用の木を得るには [dev.spectre.core.Resolver] を通す。
 */
data class Document(
    val schemaVersion: String,
    val id: String,
    val version: String? = null,
    val meta: DocumentMeta = DocumentMeta(),
    val data: SpValue.Obj = SpValue.EmptyObj,
    val state: SpValue.Obj = SpValue.EmptyObj,
    val root: Node,
    val overlays: List<Overlay> = emptyList(),
    val onAppear: List<SpValue> = emptyList(),
    val onDisappear: List<SpValue> = emptyList(),
    /**
     * パース前の生の JSON 表現。`applyPatch` (RFC 6902) はここに対して適用し、
     * その結果を再パースして新しい [Document] を作る — [root] は props/rawProps/nodeProps
     * に振り分け済みで、その分割を逆変換せずに部分更新するのは壊れやすいため
     * (docs/spec/actions.md `applyPatch`)。[DocumentParser] を経由せずに手で組み立てた
     * ドキュメント (テストなど) では null になり、その場合 `applyPatch` は働かない。
     */
    val raw: SpValue.Obj? = null,
)

data class DocumentMeta(
    val title: String? = null,
    val statePolicy: StatePolicy = StatePolicy.RESET,
    val pullToRefresh: Boolean = false,
    val refreshIntervalSec: Int? = null,
)

enum class StatePolicy { RESET, PRESERVE }

/**
 * 未解決のノード。
 *
 * プロパティを3つに分けているのは、解決時の扱いが異なるため。
 * - [props]     … 式として解決する
 * - [rawProps]  … 解決しない。アクションはディスパッチ時に評価されるため
 *                 (`${state.qty + 1}` は「タップした時点の state」を見る必要がある)
 * - [nodeProps] … 子ノードとして再帰的に解決する
 *
 * この振り分けは [GeneratedCatalog] がコンポーネントマニフェストから生成する。
 */
data class Node(
    val type: String,
    val id: String? = null,
    val props: Map<String, SpValue> = emptyMap(),
    val rawProps: Map<String, SpValue> = emptyMap(),
    val nodeProps: Map<String, List<Node>> = emptyMap(),
    val children: List<Node> = emptyList(),
    val layout: Map<String, SpValue> = emptyMap(),
    val style: Map<String, SpValue> = emptyMap(),
    val a11y: Map<String, SpValue> = emptyMap(),
    val visibleWhen: String? = null,
    val repeat: RepeatSpec? = null,
    val fallback: Node? = null,
    val optional: Boolean = false,
)

data class RepeatSpec(
    val forExpression: String,
    val asName: String = "item",
    val indexName: String = "index",
    val key: String? = null,
    val limit: Int? = null,
    val emptyView: Node? = null,
)

data class Overlay(
    val id: String,
    val kind: OverlayKind,
    val props: Map<String, SpValue> = emptyMap(),
    val root: Node? = null,
    val buttons: List<OverlayButton> = emptyList(),
)

enum class OverlayKind { SHEET, ALERT, TOAST }

data class OverlayButton(
    val label: String,
    val role: String = "default",
    val actions: List<SpValue> = emptyList(),
)

// ---------------------------------------------------------------------------
// 解決済みの描画木
// ---------------------------------------------------------------------------

/**
 * 式が解決され、未対応コンポーネントの劣化処理も済んだ描画用ノード。
 *
 * レンダラはこの型しか見ない。分岐も式評価も持たないため、iOS/Android の
 * レンダラ実装を薄く保てる (docs/architecture.md §2)。
 */
data class RenderNode(
    val type: String,
    val id: String? = null,
    /** repeat の要素を区別する安定キー。差分描画に使う。 */
    val key: String? = null,
    val props: Map<String, SpValue> = emptyMap(),
    val rawProps: Map<String, SpValue> = emptyMap(),
    val nodeProps: Map<String, List<RenderNode>> = emptyMap(),
    val children: List<RenderNode> = emptyList(),
    val layout: Map<String, SpValue> = emptyMap(),
    val style: Map<String, SpValue> = emptyMap(),
    val a11y: Map<String, SpValue> = emptyMap(),
) {
    fun prop(name: String): SpValue = props[name] ?: SpValue.Null
    fun actions(name: String): List<SpValue> =
        (rawProps[name] as? SpValue.Arr)?.items ?: emptyList()
    fun nodes(name: String): List<RenderNode> = nodeProps[name] ?: emptyList()
    fun node(name: String): RenderNode? = nodeProps[name]?.firstOrNull()
}

/** 解決済みのオーバレイ。 */
data class RenderOverlay(
    val id: String,
    val kind: OverlayKind,
    val props: Map<String, SpValue> = emptyMap(),
    val root: RenderNode? = null,
    val buttons: List<RenderOverlayButton> = emptyList(),
)

data class RenderOverlayButton(
    val label: String,
    val role: String,
    val actions: List<SpValue>,
)

/** 解決の結果と、その過程で起きた劣化・エラーの記録。 */
data class ResolveResult(
    val root: RenderNode?,
    val overlays: List<RenderOverlay> = emptyList(),
    val degradations: List<Degradation> = emptyList(),
    val exprErrors: List<String> = emptyList(),
)

/**
 * [Resolver.resolveTraced] / [Resolver.reresolveTraced] の戻り値。
 *
 * [nodeResults] は解決に使った未解決 [Node] を [RenderNode] の列に対応付けたもので、
 * 差分再解決が「このノードは前回と同じ結果を返す」と判断したときに再利用する。
 * 呼び出し側 (画面コントローラ) はこれを次回の差分再解決にそのまま渡す以外の用途では
 * 使わない — [Node] は式評価の実装詳細であり、レンダラに公開する型ではない。
 */
class TracedResolveResult(
    val result: ResolveResult,
    internal val nodeResults: Map<Node, List<RenderNode>>,
)

/**
 * 未対応コンポーネントに遭遇したときの劣化の記録。
 *
 * これを集計して「このコンポーネントは現在のユーザの何%で劣化するか」を
 * 実測し、エディタに還流させる (docs/compatibility.md §6)。
 */
data class Degradation(
    val nodeType: String,
    val nodeId: String?,
    val degradedTo: DegradedTo,
    /**
     * ドキュメント側が `optional: true` で「無くてもよい」と宣言していたか。
     * 意図された省略と、対処されていない非対応とをテレメトリ上で区別するために持つ。
     */
    val intentional: Boolean = false,
)

enum class DegradedTo {
    /** fallback ノードに置換された */
    FALLBACK,

    /** 木から取り除かれた (`optional: true`) */
    OMITTED,

    /**
     * 必須 (`optional` でない) かつ `fallback` もない未対応ノードが、
     * 汎用プレースホルダに置き換えられた。
     *
     * 劣化の3段階 (fallback → 省略 → プレースホルダ) の最終手段
     * (docs/compatibility.md §3, ADR-0006)。省略と違って画面上に痕跡を残すため、
     * 「何かが表示されないまま失われた」ことが利用者にもテレメトリにも見える。
     */
    PLACEHOLDER;

    val wireName: String get() = when (this) {
        FALLBACK -> "fallback"
        OMITTED -> "omitted"
        PLACEHOLDER -> "placeholder"
    }
}

/**
 * 必須かつ `fallback` のない未対応ノードが劣化した先の合成コンポーネント型。
 *
 * [GeneratedCatalog] には現れない — マニフェスト由来のコンポーネントと衝突しない名前空間を
 * 使うことで、レンダラはこの型だけを特別扱いして汎用プレースホルダを描ける
 * (`docs/compatibility.md` §3 の劣化順序の最終防衛線)。
 */
const val PLACEHOLDER_NODE_TYPE = "Spectre.UnsupportedComponent"
