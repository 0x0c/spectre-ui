import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// packages/manifest/src -> リポジトリルートは3つ上
const defaultManifestPath = resolve(here, '../../../spec/component-manifest.json')

export interface ComponentSpec {
  name: string
  category: string
  acceptsChildren: boolean
  /** 既知のトップレベルプロパティ名。ここにないキーは無視してよい。 */
  propNames: Set<string>
  actionPaths: string[]
  nodePaths: string[]
}

export interface SpectreManifest {
  manifestVersion: string
  schemaVersion: string
  componentsByName: Map<string, ComponentSpec>
  actionNames: Set<string>
}

/**
 * `spec/component-manifest.json` を読み、クライアント SDK の `GeneratedCatalog` と
 * 同じ形に分類する — 分類ロジックは `packages/codegen/generate.mjs` の `classify()`
 * と同じもの。クライアントはビルド時にコード生成するが、サーバとエディタは Node
 * 実行時に直接このファイルを読める。生成ステップを挟まない分、常に最新になる
 * (SU-0006 の「マニフェストのローダ」に相当)。
 */
export function loadManifest(manifestPath: string = defaultManifestPath): SpectreManifest {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const componentsByName = new Map<string, ComponentSpec>()
  for (const component of raw.components) {
    componentsByName.set(component.name, classify(component))
  }
  return {
    manifestVersion: raw.manifestVersion,
    schemaVersion: raw.schemaVersion,
    componentsByName,
    actionNames: new Set(raw.actions.map((a: { name: string }) => a.name)),
  }
}

interface RawPropSpec {
  type?: string
  shape?: Record<string, RawPropSpec>
  items?: RawPropSpec
}

function classify(component: { name: string; category: string; children?: unknown; props?: Record<string, RawPropSpec> }): ComponentSpec {
  const actionPaths: string[] = []
  const nodePaths: string[] = []
  const propNames: string[] = []

  function walk(shape: Record<string, RawPropSpec>, prefix: string) {
    for (const [name, spec] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${name}` : name
      const type = spec.type
      if (type === 'actions') {
        actionPaths.push(path)
      } else if (type === 'node') {
        nodePaths.push(path)
      } else if (type === 'array' && spec.items?.type === 'node') {
        nodePaths.push(`${path}[]`)
      } else if (type === 'object' && spec.shape) {
        walk(spec.shape, path)
      }
      if (!prefix) propNames.push(name)
    }
  }

  walk(component.props ?? {}, '')
  return {
    name: component.name,
    category: component.category,
    acceptsChildren: component.children !== false,
    propNames: new Set(propNames),
    actionPaths,
    nodePaths,
  }
}
