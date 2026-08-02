import type { Expr, ExprError } from './expr.js'
import type { SpValue } from './value.js'
import { compareNumbers, deepEquals, EMPTY_OBJ, isTruthy, stringify, toIntTruncating } from './value.js'
import { invokeBuiltin } from './builtins.js'

/**
 * 式評価のスコープ。
 *
 * `data` は不変、`state` は可変、`item`/`index` は repeat の内側でのみ導入される。
 */
export interface EvalScope {
  data: SpValue
  state: SpValue
  env: SpValue
  locals: Record<string, SpValue>
}

export function makeScope(partial: Partial<EvalScope> = {}): EvalScope {
  return {
    data: partial.data ?? EMPTY_OBJ,
    state: partial.state ?? EMPTY_OBJ,
    env: partial.env ?? EMPTY_OBJ,
    locals: partial.locals ?? {},
  }
}

export function withLocals(scope: EvalScope, extra: Record<string, SpValue>): EvalScope {
  return { ...scope, locals: { ...scope.locals, ...extra } }
}

function lookup(scope: EvalScope, name: string): SpValue | undefined {
  switch (name) {
    case 'data':
      return scope.data
    case 'state':
      return scope.state
    case 'env':
      return scope.env
    default:
      return scope.locals[name]
  }
}

export interface EvalResult {
  value: SpValue
  errors: ExprError[]
}

/**
 * SpectreExpr の評価器。
 *
 * 評価は例外を投げない。エラーは値 `null` と `ExprError` の記録として現れる
 * (docs/spec/expression.md §5)。壊れた式で画面全体が落ちるより、その部分だけが
 * 空になるほうが害が小さいという判断。
 */
export function evaluate(expr: Expr, scope: EvalScope): EvalResult {
  const errors: ExprError[] = []
  const value = evalExpr(expr, scope, errors)
  return { value, errors }
}

function evalExpr(expr: Expr, scope: EvalScope, errors: ExprError[]): SpValue {
  switch (expr.kind) {
    case 'Literal':
      return expr.value

    case 'Identifier':
      return lookup(scope, expr.name) ?? null

    case 'Member': {
      const target = evalExpr(expr.target, scope, errors)
      // null や非オブジェクトへのアクセスは null。'.' と '?.' の動作は同じで、
      // '?.' は読み手に意図を伝えるための糖衣構文 (docs/spec/expression.md §3)。
      if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
        return Object.prototype.hasOwnProperty.call(target, expr.name) ? target[expr.name] : null
      }
      return null
    }

    case 'Index': {
      const target = evalExpr(expr.target, scope, errors)
      const index = evalExpr(expr.index, scope, errors)
      if (Array.isArray(target) && typeof index === 'number') {
        const i = toIntTruncating(index)
        return i >= 0 && i < target.length ? target[i] : null
      }
      if (target !== null && typeof target === 'object' && !Array.isArray(target) && typeof index === 'string') {
        return Object.prototype.hasOwnProperty.call(target, index) ? target[index] : null
      }
      if (typeof target === 'string' && typeof index === 'number') {
        const i = toIntTruncating(index)
        return i >= 0 && i < target.length ? target[i] : null
      }
      return null
    }

    case 'Call': {
      const args = expr.args.map((a) => evalExpr(a, scope, errors))
      return invokeBuiltin(expr.name, args, scope, errors)
    }

    case 'Unary':
      if (expr.op === '!') return !isTruthy(evalExpr(expr.operand, scope, errors))
      if (expr.op === '-') {
        const v = evalExpr(expr.operand, scope, errors)
        if (typeof v === 'number') return -v
        return typeError(errors, "単項 '-' は数値にのみ適用できます")
      }
      return typeError(errors, `未知の単項演算子 '${expr.op}'`)

    case 'Binary':
      return evalBinary(expr, scope, errors)

    case 'Ternary':
      return isTruthy(evalExpr(expr.condition, scope, errors))
        ? evalExpr(expr.ifTrue, scope, errors)
        : evalExpr(expr.ifFalse, scope, errors)

    case 'ArrayLit':
      return expr.items.map((item) => evalExpr(item, scope, errors))

    case 'ObjectLit': {
      // `Object.create(null)`: a document key literally named `__proto__` must become a normal
      // own property, not trigger the `Object.prototype.__proto__` accessor via `out[k] = ...`.
      const out: { [key: string]: SpValue } = Object.create(null)
      for (const [k, v] of expr.entries) out[k] = evalExpr(v, scope, errors)
      return out
    }
  }
}

function evalBinary(expr: Extract<Expr, { kind: 'Binary' }>, scope: EvalScope, errors: ExprError[]): SpValue {
  // && と || は短絡評価する。右辺は必要になるまで評価しない。
  if (expr.op === '&&') {
    const left = evalExpr(expr.left, scope, errors)
    if (!isTruthy(left)) return false
    return isTruthy(evalExpr(expr.right, scope, errors))
  }
  if (expr.op === '||') {
    const left = evalExpr(expr.left, scope, errors)
    if (isTruthy(left)) return true
    return isTruthy(evalExpr(expr.right, scope, errors))
  }

  const l = evalExpr(expr.left, scope, errors)
  const r = evalExpr(expr.right, scope, errors)

  switch (expr.op) {
    case '==':
      return deepEquals(l, r)
    case '!=':
      return !deepEquals(l, r)

    case '+':
      if (typeof l === 'number' && typeof r === 'number') return l + r
      // どちらかが文字列なら連結。数値との連結は日常的に必要なため許す。
      if (typeof l === 'string' && (typeof r === 'string' || typeof r === 'number')) return l + stringify(r)
      if (typeof r === 'string' && typeof l === 'number') return stringify(l) + r
      return typeError(errors, "'+' は数値同士か、文字列と数値/文字列にのみ適用できます")

    case '-':
    case '*':
    case '/':
    case '%':
      if (typeof l !== 'number' || typeof r !== 'number') {
        return typeError(errors, `'${expr.op}' は数値にのみ適用できます`)
      }
      if ((expr.op === '/' || expr.op === '%') && r === 0) {
        // 0 除算は例外にせず null。表示が空になるだけで画面は壊れない。
        return typeError(errors, '0 で除算しました')
      }
      switch (expr.op) {
        case '-': return l - r
        case '*': return l * r
        case '/': return l / r
        default: return l % r
      }

    case '<':
    case '<=':
    case '>':
    case '>=':
      return compare(l, r, expr.op, errors)

    default:
      return typeError(errors, `未知の二項演算子 '${expr.op}'`)
  }
}

function compare(l: SpValue, r: SpValue, op: string, errors: ExprError[]): SpValue {
  let cmp: number
  if (typeof l === 'number' && typeof r === 'number') {
    cmp = compareNumbers(l, r)
  } else if (typeof l === 'string' && typeof r === 'string') {
    cmp = l < r ? -1 : l > r ? 1 : 0
  } else {
    return typeError(errors, `'${op}' は同じ型 (数値同士・文字列同士) にのみ適用できます`)
  }
  switch (op) {
    case '<': return cmp < 0
    case '<=': return cmp <= 0
    case '>': return cmp > 0
    default: return cmp >= 0
  }
}

export function typeError(errors: ExprError[], message: string): null {
  errors.push({ code: 'E_TYPE', message })
  return null
}
