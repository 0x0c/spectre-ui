import { buildEditorManifest } from '@spectre-ui/manifest/editor-schema'
import rawManifest from './rawManifest'

/**
 * 実行時にマニフェストから構築される、パレット・インスペクタ・アクションエディタの唯一の
 * データ源 (SU-0003 Detailed design 項目1)。新しいコンポーネントが
 * spec/component-manifest.json に追加されても、このファイルとその消費側は1行も変える必要がない。
 */
export const editorManifest = buildEditorManifest(rawManifest)
