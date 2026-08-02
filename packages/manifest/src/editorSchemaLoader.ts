import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEditorManifest, type EditorManifest } from './editorSchema'

const here = dirname(fileURLToPath(import.meta.url))
// packages/manifest/src -> リポジトリルートは3つ上
const defaultManifestPath = resolve(here, '../../../spec/component-manifest.json')

/**
 * Node 専用の便利ローダ。テストやサーバ側のツールから使う。
 * ブラウザ側 (packages/editor) はこのファイルを import せず、`editorSchema.ts` の
 * `buildEditorManifest` を、Vite が束ねた spec/component-manifest.json の JSON import と
 * 組み合わせて直接使う — 理由は `editorSchema.ts` 冒頭のコメントを参照。
 */
export function loadEditorManifest(manifestPath: string = defaultManifestPath): EditorManifest {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return buildEditorManifest(raw)
}
