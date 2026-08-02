// examples/screens/product-detail.json (SU-0003 の設計ノートが指す実例) を、キャンバスの
// スモークテストと既定のサンプルドキュメントとして使う。packages/editor/src -> リポジトリ
// ルートは2つ上、同じ深さの相対パスは manifest/rawManifest.ts と揃えてある。
import productDetail from '../../../../examples/screens/product-detail.json'
import type { SpectreDocument } from '@spectre-ui/manifest/generated'

export default productDetail as unknown as SpectreDocument
