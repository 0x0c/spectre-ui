import { ExprCache } from './parser.js'
import type { ExprError } from './expr.js'
import type { EvalScope, EvalResult } from './evaluator.js'
import { evaluate } from './evaluator.js'
import { stringify } from './value.js'

/**
 * `${...}` を含む文字列テンプレート。
 *
 * 文字列全体がちょうど1つの `${...}` なら `whole` になり、評価結果の型が保存される。
 * それ以外は `mixed` で、各部分を文字列化して連結する (docs/spec/expression.md §1)。
 */
export type Template =
  | { kind: 'literal'; text: string }
  | { kind: 'whole'; source: string }
  | { kind: 'mixed'; parts: TemplatePart[] }

export type TemplatePart = { kind: 'text'; text: string } | { kind: 'expression'; source: string }

/**
 * テンプレート文字列を解析する。
 *
 * `$${` はリテラルの `${` へのエスケープ。
 */
export function parseTemplate(source: string): Template {
  if (!source.includes('$')) return { kind: 'literal', text: source }

  const parts: TemplatePart[] = []
  let text = ''
  let i = 0

  const flushText = () => {
    if (text.length > 0) {
      parts.push({ kind: 'text', text })
      text = ''
    }
  }

  while (i < source.length) {
    const c = source[i]
    if (c === '$' && source[i + 1] === '$' && source[i + 2] === '{') {
      text += '${'
      i += 3
      continue
    }
    if (c === '$' && source[i + 1] === '{') {
      const end = findClosingBrace(source, i + 2)
      if (end < 0) {
        // 閉じられていない '${' はリテラルとして扱う。ここで例外にすると
        // 「$1,000 のような文字列を書いたら画面が落ちる」ことになる。
        text += source.substring(i)
        break
      }
      flushText()
      parts.push({ kind: 'expression', source: source.substring(i + 2, end) })
      i = end + 1
      continue
    }
    text += c
    i++
  }
  flushText()

  if (parts.length === 0) return { kind: 'literal', text: '' }
  if (parts.length === 1 && parts[0].kind === 'expression') return { kind: 'whole', source: parts[0].source }
  if (parts.every((p) => p.kind === 'text')) {
    return { kind: 'literal', text: parts.map((p) => (p as { kind: 'text'; text: string }).text).join('') }
  }
  return { kind: 'mixed', parts }
}

/**
 * `${` に対応する `}` の位置を返す。見つからなければ -1。
 *
 * 式の中のオブジェクトリテラル `{...}` と文字列リテラル内の `}` を正しく読み飛ばす。
 */
function findClosingBrace(source: string, start: number): number {
  let depth = 0
  let i = start
  while (i < source.length) {
    const c = source[i]
    if (c === "'" || c === '"') {
      i++
      while (i < source.length && source[i] !== c) {
        if (source[i] === '\\') i++
        i++
      }
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      if (depth === 0) return i
      depth--
    }
    i++
  }
  return -1
}

/**
 * テンプレートの評価。式のパースは `ExprCache` を通すため、同じ文字列の再パースは起きない。
 */
export class TemplateEvaluator {
  private readonly cache = new ExprCache()
  private readonly templates = new Map<string, Template>()

  templateOf(source: string): Template {
    let template = this.templates.get(source)
    if (template === undefined) {
      template = parseTemplate(source)
      this.templates.set(source, template)
    }
    return template
  }

  evaluate(source: string, scope: EvalScope): EvalResult {
    return this.evaluateTemplate(this.templateOf(source), scope)
  }

  private evaluateTemplate(template: Template, scope: EvalScope): EvalResult {
    if (template.kind === 'literal') return { value: template.text, errors: [] }
    if (template.kind === 'whole') return this.evaluateExpression(template.source, scope)

    const errors: ExprError[] = []
    let out = ''
    for (const part of template.parts) {
      if (part.kind === 'text') {
        out += part.text
      } else {
        const result = this.evaluateExpression(part.source, scope)
        errors.push(...result.errors)
        out += stringify(result.value)
      }
    }
    return { value: out, errors }
  }

  private evaluateExpression(source: string, scope: EvalScope): EvalResult {
    const cached = this.cache.get(source)
    if (!cached.ok) return { value: null, errors: [cached.error.error] }
    return evaluate(cached.value, scope)
  }

  /** ドキュメント読み込み時に全式を事前解析し、パースエラーを一括検出する。 */
  precompile(source: string): ExprError[] {
    const errors: ExprError[] = []
    const check = (exprSource: string) => {
      const result = this.cache.get(exprSource)
      if (!result.ok) errors.push(result.error.error)
    }
    const template = this.templateOf(source)
    if (template.kind === 'whole') check(template.source)
    if (template.kind === 'mixed') {
      for (const part of template.parts) if (part.kind === 'expression') check(part.source)
    }
    return errors
  }
}
