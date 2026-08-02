import type { SpValue } from './value.js'

/**
 * SpectreExpr の抽象構文木。
 *
 * ラムダ・関数定義・代入・ループを持たないため、評価は AST のサイズに比例した
 * 有限時間で必ず停止する (docs/spec/expression.md §3)。
 */
export type Expr =
  | { kind: 'Literal'; value: SpValue }
  | { kind: 'Identifier'; name: string }
  | { kind: 'Member'; target: Expr; name: string; nullSafe: boolean }
  | { kind: 'Index'; target: Expr; index: Expr }
  // 呼び出せるのは組み込み関数だけ。任意の式を callee にはできない。
  | { kind: 'Call'; name: string; args: Expr[] }
  | { kind: 'Unary'; op: string; operand: Expr }
  | { kind: 'Binary'; op: string; left: Expr; right: Expr }
  | { kind: 'Ternary'; condition: Expr; ifTrue: Expr; ifFalse: Expr }
  | { kind: 'ArrayLit'; items: Expr[] }
  | { kind: 'ObjectLit'; entries: [string, Expr][] }

export type ExprErrorCode = 'E_PARSE' | 'E_TYPE' | 'E_UNKNOWN_FN' | 'E_DEPTH'

export interface ExprError {
  code: ExprErrorCode
  message: string
}

export class ExprParseException extends Error {
  readonly error: ExprError
  constructor(error: ExprError) {
    super(error.message)
    this.error = error
  }
}
