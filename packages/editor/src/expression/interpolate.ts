/**
 * SpectreExpr の最小限のローカル実装 (docs/spec/expression.md §1 の埋め込み・型保存規則のみ)。
 *
 * これは適合性の対象になる本物の評価器ではない。M2 のブラウザプレビューは近似であって
 * 権威ではないため (ADR-0005)、この段階では data.foo / state.bar のような単純な
 * ドットパスだけを解決する。演算子・三項演算子・組み込み関数は対象外 — それらを含む式は
 * 「評価できない」として、値を壊さず生の式をそのまま表示に返す。
 *
 * 差し替え地点: packages/core に SpectreExpr の本物の TypeScript 実装が着地したら
 * (このワークツリーには未マージ)、この一式をそちらへ置き換える。呼び出し側
 * (canvas/componentViews.tsx, inspector 側のライブプレビュー) はこのモジュールの
 * interpolate / previewText の形にだけ依存しているので、置き換えの影響範囲は小さい。
 */

export interface InterpolationScope {
  data?: unknown
  state?: unknown
  env?: unknown
  item?: unknown
  index?: number
}

const SIMPLE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])*$/

/** data.product.sizes[0].label のような、単純なドットパス（演算子・関数呼び出しを含まない）か。 */
export function isSimplePath(expr: string): boolean {
  return SIMPLE_PATH.test(expr.trim())
}

function toSegments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment.length > 0)
}

/** 単純パスをスコープに対して解決する。存在しないプロパティは undefined（式言語の null 相当）。 */
export function resolvePath(path: string, scope: InterpolationScope): unknown {
  let current: unknown = scope
  for (const segment of toSegments(path)) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

/**
 * 補間で値を文字列化するときの規則 (docs/spec/expression.md §1「文字列化の規則」)。
 * null は空文字、boolean は true/false、数値は整数なら小数部を落とす、
 * オブジェクトはキーを辞書順に固定した JSON。
 */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return JSON.stringify(sortKeysDeep(value))
  if (typeof value === 'object') return JSON.stringify(sortKeysDeep(value))
  return String(value)
}

/**
 * 部分補間を左から右へ1パスで走査する。正規表現の置換 + 一時マーカーでのエスケープ退避は、
 * マーカー文字がテキスト本体と衝突する事故を作りやすいので避け、素直な走査にしている。
 */
function interpolatePartial(raw: string, scope: InterpolationScope): string {
  let result = ''
  let i = 0
  while (i < raw.length) {
    if (raw.startsWith('$${', i)) {
      result += '${'
      i += 3
      continue
    }
    if (raw.startsWith('${', i)) {
      const end = raw.indexOf('}', i)
      if (end === -1) {
        result += raw.slice(i)
        break
      }
      const inner = raw.slice(i + 2, end).trim()
      result += isSimplePath(inner) ? stringifyValue(resolvePath(inner, scope)) : raw.slice(i, end + 1)
      i = end + 1
      continue
    }
    result += raw[i]
    i += 1
  }
  return result
}

/**
 * ${...} を解決する。文字列全体がちょうど1つの ${...} からなる場合は評価結果の型を
 * そのまま返し (number / boolean / array / object / undefined)、それ以外は文字列補間として
 * 文字列を返す。$${ は ${ のリテラルとしてエスケープする。
 *
 * サポート外の式（単純パスでないもの）に出会ったときは、値を捏造せず式をそのまま
 * 文字列に残す — 「評価できていない」ことが編集者に見えるようにするため。
 */
export function interpolate(raw: unknown, scope: InterpolationScope): unknown {
  if (typeof raw !== 'string') return raw
  if (!raw.includes('${')) return raw

  const wholeMatch = /^\$\{([^{}]*)\}$/.exec(raw)
  if (wholeMatch) {
    const inner = wholeMatch[1].trim()
    if (isSimplePath(inner)) return resolvePath(inner, scope)
    return raw
  }

  return interpolatePartial(raw, scope)
}

/** UI 表示用: 常に文字列を返す interpolate のラッパー。 */
export function previewText(raw: unknown, scope: InterpolationScope): string {
  const value = interpolate(raw, scope)
  return typeof value === 'string' ? value : stringifyValue(value)
}

/**
 * 真値判定 (docs/spec/expression.md §1「真値判定」) — `visibleWhen` / `enabled` /
 * `loading` のような boolean を要求する箇所で使う。
 */
export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false
  if (value === true) return true
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}

export interface ConditionResult {
  value: boolean
  /** false なら「評価できなかった」— 単純パスでない式が渡された（サポート外）。 */
  evaluated: boolean
}

/**
 * boolean を要求する式フィールド (`visibleWhen` など) の評価。単純パスで評価できた場合だけ
 * `evaluated: true` を返す。評価できない場合は、コンテンツを不意に隠さないよう既定で
 * 「表示する」側に倒す — 呼び出し側は `evaluated: false` を見て、未評価であることを
 * 目立たせる表示(破線の枠など)を足すことができる。
 */
export function evaluateCondition(raw: unknown, scope: InterpolationScope): ConditionResult {
  if (typeof raw !== 'string') return { value: isTruthy(raw), evaluated: true }
  if (!raw.includes('${')) return { value: isTruthy(raw), evaluated: true }

  const wholeMatch = /^\$\{([^{}]*)\}$/.exec(raw)
  if (!wholeMatch) return { value: isTruthy(raw), evaluated: true }

  const inner = wholeMatch[1].trim()
  if (!isSimplePath(inner)) return { value: true, evaluated: false }
  return { value: isTruthy(resolvePath(inner, scope)), evaluated: true }
}
