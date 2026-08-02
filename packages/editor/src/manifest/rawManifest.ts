// spec/component-manifest.json (ADR-0002 の単一の情報源) をビルド時に取り込む。
// packages/manifest の `editorSchema.ts` は純粋な変換関数だけを持ち、生JSONの読み方は
// 呼び出し側に委ねている — サーバ/テストは `node:fs` で読み、ここでは Vite の JSON import で
// 読む。パスの深さは packages/manifest/src からの相対パスと同じ (packages/editor/src -> ルートは2つ上)。
import raw from '../../../../spec/component-manifest.json'
import type { RawManifestFile } from '@spectre-ui/manifest/editor-schema'

export default raw as unknown as RawManifestFile
