/**
 * ドキュメント・状態・式評価で扱う値の統一表現。
 *
 * Kotlin (`SpValue`) / Swift (`SpValue`) は sealed type/enum でラップするが、
 * TypeScript は `typeof` / `Array.isArray` で同じ判別ができるため、JSON の値域を
 * そのまま表現する型エイリアスにしてある。数値は常に `number` (Double 相当)。
 */
export type SpValue = null | boolean | number | string | SpValue[] | { [key: string]: SpValue }

export const EMPTY_OBJ: SpValue = {}

// ---------------------------------------------------------------------------
// 真偽判定 (docs/spec/expression.md §3)
// ---------------------------------------------------------------------------

export function isTruthy(v: SpValue): boolean {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v)
  if (typeof v === 'string') return v.length > 0
  if (Array.isArray(v)) return v.length > 0
  return Object.keys(v).length > 0
}

/** `default()` が代替値に差し替える「空」の判定。null と空文字/空配列/空オブジェクトが対象。 */
export function isBlank(v: SpValue): boolean {
  if (v === null) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v).length === 0
  return false
}

// ---------------------------------------------------------------------------
// 文字列化 (docs/spec/expression.md §1)
// ---------------------------------------------------------------------------

/**
 * 文字列補間で使う表現。
 *
 * null が空文字になるのは UI 表示のため。`"在庫: ${data.stock}"` で
 * stock が欠けているときに `"在庫: null"` と出るより空のほうが害が小さい。
 */
export function stringify(v: SpValue): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return formatNumberPlain(v)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return `[${v.map(toJsonLikeString).join(',')}]`
  // キーは辞書順に固定する。Swift の Dictionary は順序を持たないため、
  // 挿入順に依存すると iOS と Android で出力が食い違う。
  const keys = Object.keys(v).sort()
  return `{${keys.map((k) => `${quoteJson(k)}:${toJsonLikeString(v[k])}`).join(',')}}`
}

function toJsonLikeString(v: SpValue): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return quoteJson(v)
  return stringify(v)
}

function quoteJson(s: string): string {
  let out = '"'
  for (const c of s) {
    switch (c) {
      case '"':
        out += '\\"'
        break
      case '\\':
        out += '\\\\'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      default:
        out += c
    }
  }
  return out + '"'
}

/** ロケール非依存の素の数値表記。整数値は小数部を落とす (1280.0 -> "1280")。 */
export function formatNumberPlain(d: number): string {
  if (Number.isNaN(d)) return 'NaN'
  if (!Number.isFinite(d)) return d > 0 ? 'Infinity' : '-Infinity'
  if (d === 0) return '0'
  if (isWholeNumber(d)) return Math.trunc(d).toString()
  return d.toString()
}

export function isWholeNumber(d: number): boolean {
  return !Number.isNaN(d) && Number.isFinite(d) && d === Math.floor(d) && Math.abs(d) < 1e15
}

/**
 * Kotlin's `Double.compareTo` (`java.lang.Double.compare`) total order: NaN sorts as the
 * greatest value (equal only to itself), and `-0.0 < 0.0`. Plain `<`/`>` in JavaScript treats
 * every NaN comparison as `false` and does not distinguish signed zero, so `<`/`<=`/`>`/`>=`
 * on numbers must go through this instead of the raw operators to match the other two runtimes.
 */
export function compareNumbers(a: number, b: number): number {
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1
  if (Number.isNaN(b)) return -1
  if (a < b) return -1
  if (a > b) return 1
  const aNeg = Object.is(a, -0)
  const bNeg = Object.is(b, -0)
  if (aNeg === bNeg) return 0
  return aNeg ? -1 : 1
}

const INT32_MAX = 2147483647
const INT32_MIN = -2147483648

/**
 * Java/Kotlin's `Double.toInt()` narrowing conversion (JLS 5.1.3): `NaN` becomes `0`, and an
 * out-of-range or infinite value clamps to `Int.MAX_VALUE`/`Int.MIN_VALUE` instead of JavaScript's
 * `Math.trunc`, which leaves `NaN`/`Infinity` untouched and would disagree on an index computed
 * from an overflowing or `NaN`-producing expression.
 */
export function toIntTruncating(d: number): number {
  if (Number.isNaN(d)) return 0
  if (d === Number.POSITIVE_INFINITY) return INT32_MAX
  if (d === Number.NEGATIVE_INFINITY) return INT32_MIN
  const truncated = Math.trunc(d)
  if (truncated > INT32_MAX) return INT32_MAX
  if (truncated < INT32_MIN) return INT32_MIN
  return truncated
}

/** 型変換をしない厳密比較。配列/オブジェクトは構造的に比較する。 */
export function deepEquals(a: SpValue, b: SpValue): boolean {
  if (a === null || b === null) return a === b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEquals(item, b[i]))
  }
  if (typeof a === 'object' && !Array.isArray(a) && typeof b === 'object' && !Array.isArray(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEquals(a[k], b[k]))
  }
  return false
}

/** ドット区切りのパスで値を辿る。存在しなければ null。 */
export function path(value: SpValue, p: string): SpValue {
  if (p === '') return value
  let current = value
  for (const segment of p.split('.')) {
    if (current !== null && typeof current === 'object' && !Array.isArray(current)) {
      current = Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : null
    } else if (Array.isArray(current)) {
      // Kotlin の `toIntOrNull()` に合わせ、厳密に整数として読めるときだけ添字にする
      // ("3abc" は parseInt だと 3 になってしまうため使わない)。
      const idx = /^-?\d+$/.test(segment) ? Number.parseInt(segment, 10) : null
      current = idx === null ? null : (current[idx] ?? null)
    } else {
      return null
    }
    if (current === null) return null
  }
  return current
}
