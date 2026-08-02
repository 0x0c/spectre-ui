import type { EvalScope } from './evaluator.js'
import type { ExprError } from './expr.js'
import type { SpValue } from './value.js'
import { deepEquals, formatNumberPlain, isBlank, isTruthy, path, stringify } from './value.js'

/**
 * 組み込み関数のホワイトリスト。
 *
 * ユーザ定義関数もラムダも存在しないため、ここに列挙された関数がクライアントで
 * 実行されうる処理のすべてになる (docs/spec/expression.md §4)。
 *
 * `map` / `filter` / `reduce` を意図的に持たない。それらはラムダを要求して言語を
 * 一気に大きくするため、配列の加工はサーバ側で行い `data` に入れて送る。
 */
export function invokeBuiltin(name: string, args: SpValue[], scope: EvalScope, errors: ExprError[]): SpValue {
  const ctx = new Ctx(name, args, scope, errors)

  switch (name) {
    // -- 文字列 ------------------------------------------------------------
    case 'len':
    case 'count':
      return ctx.arity(1, () => {
        const v = args[0]
        if (typeof v === 'string') return v.length
        if (Array.isArray(v)) return v.length
        if (v === null) return 0
        if (typeof v === 'object') return Object.keys(v).length
        return ctx.typeError('len は文字列・配列・オブジェクトにのみ適用できます')
      })
    case 'upper':
      return ctx.arity(1, () => (ctx.str(0) !== null ? ctx.str(0)!.toUpperCase() : ctx.typeError()))
    case 'lower':
      return ctx.arity(1, () => (ctx.str(0) !== null ? ctx.str(0)!.toLowerCase() : ctx.typeError()))
    case 'trim':
      return ctx.arity(1, () => (ctx.str(0) !== null ? ctx.str(0)!.trim() : ctx.typeError()))

    case 'contains':
      return ctx.arity(2, () => {
        const target = args[0]
        if (typeof target === 'string') {
          const needle = ctx.str(1)
          return needle !== null ? target.includes(needle) : ctx.typeError()
        }
        if (Array.isArray(target)) return target.some((item) => deepEquals(item, args[1]))
        return ctx.typeError('contains は文字列または配列にのみ適用できます')
      })
    case 'startsWith':
      return ctx.arity(2, () => {
        const s = ctx.str(0)
        const p = ctx.str(1)
        return s === null || p === null ? ctx.typeError() : s.startsWith(p)
      })
    case 'endsWith':
      return ctx.arity(2, () => {
        const s = ctx.str(0)
        const p = ctx.str(1)
        return s === null || p === null ? ctx.typeError() : s.endsWith(p)
      })
    case 'join':
      return ctx.arity(2, () => {
        const arr = ctx.arr(0)
        const sep = ctx.str(1)
        return arr === null || sep === null ? ctx.typeError() : arr.map((item) => stringify(item)).join(sep)
      })
    case 'split':
      return ctx.arity(2, () => {
        const s = ctx.str(0)
        const sep = ctx.str(1)
        // 空の区切り文字は実装によって挙動が違いうるため、仕様として「分割しない」に揃える。
        if (s === null || sep === null) return ctx.typeError()
        if (sep === '') return [s]
        return s.split(sep)
      })
    case 'replace':
      return ctx.arity(3, () => {
        const s = ctx.str(0)
        const from = ctx.str(1)
        const to = ctx.str(2)
        // 正規表現ではなく単純な部分文字列置換。式言語に正規表現は入れない。
        if (s === null || from === null || to === null) return ctx.typeError()
        if (from === '') return s
        return s.split(from).join(to)
      })
    case 'slice':
      return ctx.arityRange(2, 3, () => slice(ctx))

    // -- 数値 ----------------------------------------------------------------
    case 'min':
      return ctx.arity(2, () => {
        const nums = ctx.nums2()
        return nums !== null ? Math.min(nums[0], nums[1]) : ctx.typeError()
      })
    case 'max':
      return ctx.arity(2, () => {
        const nums = ctx.nums2()
        return nums !== null ? Math.max(nums[0], nums[1]) : ctx.typeError()
      })
    case 'abs':
      return ctx.arity(1, () => (ctx.num(0) !== null ? Math.abs(ctx.num(0)!) : ctx.typeError()))
    case 'floor':
      return ctx.arity(1, () => (ctx.num(0) !== null ? Math.floor(ctx.num(0)!) : ctx.typeError()))
    case 'ceil':
      return ctx.arity(1, () => (ctx.num(0) !== null ? Math.ceil(ctx.num(0)!) : ctx.typeError()))
    case 'round':
      return ctx.arityRange(1, 2, () => round(ctx))
    case 'sum':
      return ctx.arity(1, () => sum(ctx))
    case 'toNumber':
      return ctx.arity(1, () => toNumber(args[0]))
    case 'toString':
      return ctx.arity(1, () => stringify(args[0]))

    // -- 論理・コレクション ----------------------------------------------------
    case 'if':
      return ctx.arity(3, () => (isTruthy(args[0]) ? args[1] : args[2]))
    case 'coalesce':
      return ctx.atLeast(1, () => args.find((a) => a !== null) ?? null)
    case 'default':
      return ctx.arity(2, () => (isBlank(args[0]) ? args[1] : args[0]))
    case 'has':
      return ctx.arity(2, () => {
        const obj = args[0]
        const key = ctx.str(1)
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj) || key === null) return ctx.typeError()
        return Object.prototype.hasOwnProperty.call(obj, key)
      })
    case 'get':
      return ctx.arityRange(2, 3, () => {
        const p = ctx.str(1)
        if (p === null) return ctx.typeError()
        const found = path(args[0], p)
        return found === null && args.length === 3 ? args[2] : found
      })
    case 'first':
      return ctx.arity(1, () => {
        const arr = ctx.arr(0)
        return arr === null ? ctx.typeError() : (arr[0] ?? null)
      })
    case 'last':
      return ctx.arity(1, () => {
        const arr = ctx.arr(0)
        return arr === null ? ctx.typeError() : (arr[arr.length - 1] ?? null)
      })
    case 'indexOf':
      return ctx.arity(2, () => {
        const arr = ctx.arr(0)
        if (arr === null) return ctx.typeError()
        return arr.findIndex((item) => deepEquals(item, args[1]))
      })

    // -- 環境 ------------------------------------------------------------------
    case 'isPlatform':
      return ctx.arity(1, () => stringify(path(scope.env, 'platform')) === stringify(args[0]))
    case 'versionAtLeast':
      return ctx.arity(1, () => compareVersions(stringify(path(scope.env, 'appVersion')), stringify(args[0])) >= 0)

    // -- 書式 (ロケール依存。ネイティブのフォーマッタに委譲) ----------------------
    case 'formatNumber':
      return ctx.arityRange(1, 2, () => formatNumber(ctx))
    case 'formatCurrency':
      return ctx.arity(2, () => formatCurrency(ctx))
    case 'formatPercent':
      return ctx.arityRange(1, 2, () => formatPercent(ctx))
    case 'formatDate':
      return ctx.arity(2, () => formatDate(ctx))
    case 'plural':
      return ctx.arity(2, () => plural(ctx))

    default:
      // 新しいスキーマバージョンで追加された関数を古いクライアントが受け取った場合もここに来る。
      errors.push({ code: 'E_UNKNOWN_FN', message: `未知の関数 '${name}'` })
      return null
  }
}

// -- 個別実装 ----------------------------------------------------------------

function slice(ctx: Ctx): SpValue {
  const start = ctx.num(1)
  if (start === null) return ctx.typeError()
  const hasEnd = ctx.args.length === 3
  const end = hasEnd ? ctx.num(2) : null
  if (hasEnd && end === null) return ctx.typeError()
  const target = ctx.args[0]
  if (typeof target === 'string') {
    const from = clamp(Math.trunc(start), 0, target.length)
    const to = clamp(hasEnd ? Math.trunc(end as number) : target.length, from, target.length)
    return target.substring(from, to)
  }
  if (Array.isArray(target)) {
    const from = clamp(Math.trunc(start), 0, target.length)
    const to = clamp(hasEnd ? Math.trunc(end as number) : target.length, from, target.length)
    return target.slice(from, to)
  }
  return ctx.typeError('slice は文字列または配列にのみ適用できます')
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

function round(ctx: Ctx): SpValue {
  const n = ctx.num(0)
  if (n === null) return ctx.typeError()
  const hasDigits = ctx.args.length === 2
  const digits = hasDigits ? ctx.num(1) : 0
  if (hasDigits && digits === null) return ctx.typeError()
  if (!digits) return roundHalfUp(n)
  const factor = 10 ** (digits as number)
  return roundHalfUp(n * factor) / factor
}

/** half-up (+∞方向)。Kotlin/Swift の `Math.round` 相当と同じ挙動に揃えている。 */
function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5)
}

function sum(ctx: Ctx): SpValue {
  const arr = ctx.arr(0)
  if (arr === null) return ctx.typeError()
  let total = 0
  for (const item of arr) {
    if (typeof item !== 'number') return ctx.typeError('sum は数値の配列にのみ適用できます')
    total += item
  }
  return total
}

function toNumber(value: SpValue): SpValue {
  if (typeof value === 'number') return value
  // 変換失敗は null。エラーではなく値として扱う (docs/spec/expression.md §4)。
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || Number.isNaN(Number(trimmed))) return null
    return Number(trimmed)
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  return null
}

function localeOf(ctx: Ctx): string {
  const raw = path(ctx.scope.env, 'locale')
  return typeof raw === 'string' && raw.length > 0 ? raw : 'en-US'
}

function timeZoneOf(ctx: Ctx): string {
  const raw = path(ctx.scope.env, 'timeZone')
  return typeof raw === 'string' && raw.length > 0 ? raw : 'UTC'
}

function formatNumber(ctx: Ctx): SpValue {
  const n = ctx.num(0)
  if (n === null) return ctx.typeError()
  const opts = ctx.args[1]
  const grouping =
    opts !== null && typeof opts === 'object' && !Array.isArray(opts) && 'grouping' in opts
      ? isTruthy(opts.grouping)
      : true
  const minFractionDigits =
    opts !== null && typeof opts === 'object' && !Array.isArray(opts) && typeof opts.minFractionDigits === 'number'
      ? opts.minFractionDigits
      : undefined
  const maxFractionDigits =
    opts !== null && typeof opts === 'object' && !Array.isArray(opts) && typeof opts.maxFractionDigits === 'number'
      ? opts.maxFractionDigits
      : 3
  return new Intl.NumberFormat(localeOf(ctx), {
    useGrouping: grouping,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: Math.max(maxFractionDigits, minFractionDigits ?? 0),
  }).format(n)
}

function formatCurrency(ctx: Ctx): SpValue {
  const n = ctx.num(0)
  const code = ctx.str(1)
  if (n === null || code === null) return ctx.typeError()
  try {
    return new Intl.NumberFormat(localeOf(ctx), { style: 'currency', currency: code }).format(n)
  } catch {
    return ctx.typeError(`未知の通貨コード '${code}'`)
  }
}

function formatPercent(ctx: Ctx): SpValue {
  const n = ctx.num(0)
  if (n === null) return ctx.typeError()
  const hasDigits = ctx.args.length === 2
  const digits = hasDigits ? ctx.num(1) : 0
  if (hasDigits && digits === null) return ctx.typeError()
  return new Intl.NumberFormat(localeOf(ctx), {
    style: 'percent',
    minimumFractionDigits: digits as number,
    maximumFractionDigits: digits as number,
  }).format(n)
}

function formatDate(ctx: Ctx): SpValue {
  const iso = ctx.str(0)
  const style = ctx.str(1)
  if (iso === null || style === null) return ctx.typeError()
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ctx.typeError(`ISO 8601 として解釈できません: ${iso}`)
  if (style === 'relative') return relativeDescription(date)
  if (style !== 'short' && style !== 'medium' && style !== 'long') {
    return ctx.typeError(`未知の日付スタイル '${style}'`)
  }
  return new Intl.DateTimeFormat(localeOf(ctx), { dateStyle: style, timeZone: timeZoneOf(ctx) }).format(date)
}

function relativeDescription(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  const past = seconds >= 0
  const abs = Math.abs(seconds)
  let amount: number
  let unit: string
  if (abs < 60) {
    amount = abs
    unit = '秒'
  } else if (abs < 3600) {
    amount = Math.floor(abs / 60)
    unit = '分'
  } else if (abs < 86400) {
    amount = Math.floor(abs / 3600)
    unit = '時間'
  } else {
    amount = Math.floor(abs / 86400)
    unit = '日'
  }
  return past ? `${amount}${unit}前` : `${amount}${unit}後`
}

function plural(ctx: Ctx): SpValue {
  const n = ctx.num(0)
  if (n === null) return ctx.typeError()
  const forms = ctx.args[1]
  if (forms === null || typeof forms !== 'object' || Array.isArray(forms)) {
    return ctx.typeError('plural の第2引数は形式のオブジェクトです')
  }
  const category = pluralCategory(n, localeOf(ctx))
  const hasCategory = Object.prototype.hasOwnProperty.call(forms, category)
  const form = hasCategory ? forms[category] : forms.other
  if (form === undefined) return null
  // ICU の '#' と同じく、選ばれた形式の中の '#' を数値に置換する。
  return stringify(form).replaceAll('#', formatNumberPlain(n))
}

/** v0.1 は最小限の CLDR 近似。複数形のない言語では常に other。 */
function pluralCategory(n: number, locale: string): string {
  const language = locale.split('-')[0].toLowerCase()
  if (['ja', 'zh', 'ko', 'th', 'vi', 'id', 'ms'].includes(language)) return 'other'
  return n === 1 ? 'one' : 'other'
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((seg) => Number.parseInt(seg, 10) || 0)
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const cmp = (left[i] ?? 0) - (right[i] ?? 0)
    if (cmp !== 0) return cmp
  }
  return 0
}

// -- 引数ヘルパ ----------------------------------------------------------------

class Ctx {
  constructor(
    readonly name: string,
    readonly args: SpValue[],
    readonly scope: EvalScope,
    readonly errors: ExprError[],
  ) {}

  str(i: number): string | null {
    const v = this.args[i]
    return typeof v === 'string' ? v : null
  }

  num(i: number): number | null {
    const v = this.args[i]
    return typeof v === 'number' ? v : null
  }

  arr(i: number): SpValue[] | null {
    const v = this.args[i]
    return Array.isArray(v) ? v : null
  }

  nums2(): [number, number] | null {
    const a = this.num(0)
    const b = this.num(1)
    return a === null || b === null ? null : [a, b]
  }

  typeError(message?: string): null {
    this.errors.push({ code: 'E_TYPE', message: message ?? `${this.name} の引数の型が正しくありません` })
    return null
  }

  arity(expected: number, block: () => SpValue): SpValue {
    if (this.args.length !== expected) {
      this.errors.push({
        code: 'E_TYPE',
        message: `${this.name} は引数を ${expected} 個取ります (${this.args.length} 個が渡されました)`,
      })
      return null
    }
    return block()
  }

  arityRange(min: number, max: number, block: () => SpValue): SpValue {
    if (this.args.length < min || this.args.length > max) {
      this.errors.push({
        code: 'E_TYPE',
        message: `${this.name} は引数を ${min}〜${max} 個取ります (${this.args.length} 個が渡されました)`,
      })
      return null
    }
    return block()
  }

  atLeast(min: number, block: () => SpValue): SpValue {
    if (this.args.length < min) {
      this.errors.push({ code: 'E_TYPE', message: `${this.name} は引数を ${min} 個以上取ります` })
      return null
    }
    return block()
  }
}
