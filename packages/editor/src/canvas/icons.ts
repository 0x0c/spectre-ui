/**
 * `iconToken` は文字列の自由入力 (spec/component-manifest.json では `IconToken = string`) —
 * 実際のグリフ選びはホストアプリのアイコンセットに委ねられる。近似プレビューはアイコン
 * フォントを積まず、よく出てくる名前だけ Unicode グリフに対応させ、それ以外は先頭文字の
 * バッジで代用する。これも「完全一致ではなく近似」の一部 (ADR-0005)。
 */
const GLYPHS: Record<string, string> = {
  'star.fill': '★',
  star: '☆',
  'chevron.right': '›',
  'chevron.left': '‹',
  'chevron.up': '⌃',
  'chevron.down': '⌄',
  share: '⇪',
  close: '✕',
  check: '✓',
  plus: '+',
  minus: '−',
  search: '⌕',
  heart: '♡',
  'heart.fill': '♥',
  cart: '🛒',
  device: '▭',
}

export function iconGlyph(token: string): string {
  return GLYPHS[token] ?? (token.slice(0, 1).toUpperCase() || '•')
}
