// Node の import (`node:fs` など) を一切持たない、純粋な変換関数だけを置くモジュール。
// packages/editor (SU-0003) がブラウザ側でこのファイルを直接 import できるようにするための
// 分離 — `manifest.ts` は `node:fs`/`node:url` をトップレベルで読み込むため、ブラウザ束に混ぜると
// バンドラがビルド不能になる。Node から使う便利ローダは `editorSchemaLoader.ts` 側に置く。
//
// `manifest.ts` の `classify()` はドキュメント検証 (`validate.ts`) 用に必要最小限
// (prop名の集合、action/node の位置) しか残さない。エディタのパレット・インスペクタは
// ウィジェット選択・既定値・enum値・入れ子 shape など、生のプロパティ定義をそのまま必要と
// するため、別の変換をここに持つ — ADR-0002 が言う「単一の情報源」は
// spec/component-manifest.json そのものであって、`manifest.ts` の分類結果ではないので、
// これは情報源の分岐ではなく、同じ情報源からの2つ目の読み取り方にあたる。

export interface RawPropSpec {
  type: string
  values?: (string | number)[]
  default?: unknown
  nullable?: boolean
  expression?: boolean
  required?: boolean
  description?: string
  min?: number
  max?: number
  shape?: Record<string, RawPropSpec>
  items?: RawPropSpec
  of?: RawPropSpec[]
  allow?: string[]
  editor?: { widget?: string }
}

export interface RawComponentDef {
  name: string
  category: string
  icon?: string
  rootOnly?: boolean
  children?: false | { min?: number; max?: number; description?: string }
  props?: Record<string, RawPropSpec>
  lint?: string[]
  lazy?: boolean
  since?: string
}

export interface RawActionDef {
  name: string
  since?: string
  async?: boolean
}

export interface RawManifestFile {
  manifestVersion: string
  schemaVersion: string
  tokens: {
    color: string[]
    spacing: Record<string, number>
    radius: Record<string, number>
    typography: string[]
    elevation: number[]
  }
  commonNodeProps: Record<string, RawPropSpec>
  components: RawComponentDef[]
  actions: RawActionDef[]
  limits: Record<string, number>
}

export interface ComponentDef {
  name: string
  category: string
  icon?: string
  rootOnly: boolean
  acceptsChildren: boolean
  minChildren?: number
  maxChildren?: number
  /** プロパティの出現順を保つ。マニフェスト内の宣言順がそのままパレット/インスペクタの表示順になる。 */
  props: { name: string; spec: RawPropSpec }[]
  since?: string
}

export interface ActionDef {
  name: string
  async: boolean
  since?: string
}

export interface EditorManifest {
  manifestVersion: string
  schemaVersion: string
  tokens: RawManifestFile['tokens']
  commonNodeProps: { name: string; spec: RawPropSpec }[]
  components: ComponentDef[]
  componentsByName: Map<string, ComponentDef>
  actions: ActionDef[]
}

/** 純粋な変換 — 生の spec/component-manifest.json オブジェクトから EditorManifest を組み立てる。 */
export function buildEditorManifest(raw: RawManifestFile): EditorManifest {
  const components: ComponentDef[] = raw.components.map((c) => ({
    name: c.name,
    category: c.category,
    icon: c.icon,
    rootOnly: c.rootOnly === true,
    acceptsChildren: c.children !== false,
    minChildren: c.children ? c.children.min : undefined,
    maxChildren: c.children ? c.children.max : undefined,
    props: Object.entries(c.props ?? {}).map(([name, spec]) => ({ name, spec })),
    since: c.since,
  }))

  return {
    manifestVersion: raw.manifestVersion,
    schemaVersion: raw.schemaVersion,
    tokens: raw.tokens,
    commonNodeProps: Object.entries(raw.commonNodeProps ?? {}).map(([name, spec]) => ({ name, spec })),
    components,
    componentsByName: new Map(components.map((c) => [c.name, c])),
    actions: raw.actions.map((a) => ({ name: a.name, async: a.async === true, since: a.since })),
  }
}
