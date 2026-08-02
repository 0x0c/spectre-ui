import { type Expr, ExprParseException } from './expr.js'

/**
 * SpectreExpr の字句解析 + 再帰下降パーサ。
 *
 * 文法は docs/spec/expression.md §3 の EBNF に対応する。
 * パース結果は `ExprCache` でキャッシュされるため、同じ式文字列を再パースしない。
 */
export const MAX_AST_NODES = 256
export const MAX_DEPTH = 32

export function parse(source: string): Expr {
  const tokens = new Lexer(source).tokenize()
  const parser = new Parser(tokens, source)
  const expr = parser.parseExpression()
  parser.expect('EOF', "式の後に余分な文字があります")
  return expr
}

/** パースに失敗しても例外を投げず、エラーを返す形。 */
export function tryParse(source: string): { ok: true; value: Expr } | { ok: false; error: ExprParseException } {
  try {
    return { ok: true, value: parse(source) }
  } catch (e) {
    if (e instanceof ExprParseException) return { ok: false, error: e }
    return {
      ok: false,
      error: new ExprParseException({ code: 'E_PARSE', message: e instanceof Error ? e.message : String(e) }),
    }
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type TokenType =
  | 'NUMBER' | 'STRING' | 'IDENT'
  | 'TRUE' | 'FALSE' | 'NULL'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE'
  | 'AND' | 'OR' | 'NOT'
  | 'QUESTION' | 'COLON' | 'DOT' | 'QUESTION_DOT' | 'COMMA'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'LBRACE' | 'RBRACE'
  | 'EOF'

interface Token {
  type: TokenType
  text: string
  position: number
  numberValue: number
  stringValue: string
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function isLetter(c: string): boolean {
  return /\p{L}/u.test(c)
}

function isLetterOrDigit(c: string): boolean {
  return isDigit(c) || isLetter(c)
}

class Lexer {
  private index = 0
  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = []
    for (;;) {
      this.skipWhitespace()
      if (this.index >= this.source.length) {
        tokens.push({ type: 'EOF', text: '', position: this.index, numberValue: 0, stringValue: '' })
        return tokens
      }
      tokens.push(this.nextToken())
    }
  }

  private skipWhitespace() {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) this.index++
  }

  private nextToken(): Token {
    const start = this.index
    const c = this.source[this.index]

    if (isDigit(c)) return this.number()
    if (c === "'" || c === '"') return this.string(c)
    if (isLetter(c) || c === '_' || c === '$') return this.identifier()

    this.index++
    const match = (next: string): boolean => {
      if (this.index < this.source.length && this.source[this.index] === next) {
        this.index++
        return true
      }
      return false
    }

    const simple = (type: TokenType, text: string): Token => ({ type, text, position: start, numberValue: 0, stringValue: '' })

    switch (c) {
      case '+': return simple('PLUS', '+')
      case '-': return simple('MINUS', '-')
      case '*': return simple('STAR', '*')
      case '/': return simple('SLASH', '/')
      case '%': return simple('PERCENT', '%')
      case '(': return simple('LPAREN', '(')
      case ')': return simple('RPAREN', ')')
      case '[': return simple('LBRACKET', '[')
      case ']': return simple('RBRACKET', ']')
      case '{': return simple('LBRACE', '{')
      case '}': return simple('RBRACE', '}')
      case ',': return simple('COMMA', ',')
      case '.': return simple('DOT', '.')
      case ':': return simple('COLON', ':')
      case '?': return match('.') ? simple('QUESTION_DOT', '?.') : simple('QUESTION', '?')
      case '=': return match('=') ? simple('EQ', '==') : this.fail("'=' 単体は使えません。比較は '==' です", start)
      case '!': return match('=') ? simple('NEQ', '!=') : simple('NOT', '!')
      case '<': return match('=') ? simple('LTE', '<=') : simple('LT', '<')
      case '>': return match('=') ? simple('GTE', '>=') : simple('GT', '>')
      case '&': return match('&') ? simple('AND', '&&') : this.fail("'&' 単体は使えません。論理積は '&&' です", start)
      case '|': return match('|') ? simple('OR', '||') : this.fail("'|' 単体は使えません。論理和は '||' です", start)
      default: return this.fail(`解釈できない文字 '${c}'`, start)
    }
  }

  private number(): Token {
    const start = this.index
    while (this.index < this.source.length && isDigit(this.source[this.index])) this.index++
    if (
      this.index < this.source.length &&
      this.source[this.index] === '.' &&
      this.index + 1 < this.source.length &&
      isDigit(this.source[this.index + 1])
    ) {
      this.index++
      while (this.index < this.source.length && isDigit(this.source[this.index])) this.index++
    }
    const text = this.source.substring(start, this.index)
    const value = Number(text)
    if (Number.isNaN(value)) this.fail(`数値として解釈できません: ${text}`, start)
    return { type: 'NUMBER', text, position: start, numberValue: value, stringValue: '' }
  }

  private string(quote: string): Token {
    const start = this.index
    this.index++ // 開きクォート
    let value = ''
    for (;;) {
      if (this.index >= this.source.length) this.fail('文字列が閉じられていません', start)
      const ch = this.source[this.index]
      if (ch === quote) {
        this.index++
        break
      }
      if (ch === '\\') {
        this.index++
        if (this.index >= this.source.length) this.fail('エスケープが不完全です', start)
        const esc = this.source[this.index]
        switch (esc) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case 'r': value += '\r'; break
          case '\\': value += '\\'; break
          case "'": value += "'"; break
          case '"': value += '"'; break
          default: value += esc
        }
        this.index++
      } else {
        value += ch
        this.index++
      }
    }
    return { type: 'STRING', text: this.source.substring(start, this.index), position: start, numberValue: 0, stringValue: value }
  }

  private identifier(): Token {
    const start = this.index
    while (this.index < this.source.length && (isLetterOrDigit(this.source[this.index]) || this.source[this.index] === '_')) {
      this.index++
    }
    const text = this.source.substring(start, this.index)
    const type: TokenType = text === 'true' ? 'TRUE' : text === 'false' ? 'FALSE' : text === 'null' ? 'NULL' : 'IDENT'
    return { type, text, position: start, numberValue: 0, stringValue: '' }
  }

  private fail(message: string, position: number): never {
    throw new ExprParseException({ code: 'E_PARSE', message: `${message} (位置 ${position})` })
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private index = 0
  private nodeCount = 0
  private depth = 0

  constructor(private readonly tokens: Token[], private readonly source: string) {}

  private get current(): Token {
    return this.tokens[this.index]
  }

  parseExpression(): Expr {
    return this.parseTernary()
  }

  private parseTernary(): Expr {
    this.enter()
    try {
      const condition = this.parseOr()
      if (!this.match('QUESTION')) return condition
      const ifTrue = this.parseExpression()
      this.expect('COLON', "三項演算子には ':' が必要です")
      const ifFalse = this.parseExpression()
      return this.node<Expr>({ kind: 'Ternary', condition, ifTrue, ifFalse })
    } finally {
      this.exit()
    }
  }

  private parseOr(): Expr {
    this.enter()
    try {
      let left = this.parseAnd()
      while (this.match('OR')) left = this.node<Expr>({ kind: 'Binary', op: '||', left, right: this.parseAnd() })
      return left
    } finally {
      this.exit()
    }
  }

  private parseAnd(): Expr {
    this.enter()
    try {
      let left = this.parseEquality()
      while (this.match('AND')) left = this.node<Expr>({ kind: 'Binary', op: '&&', left, right: this.parseEquality() })
      return left
    } finally {
      this.exit()
    }
  }

  private parseEquality(): Expr {
    this.enter()
    try {
      let left = this.parseComparison()
      for (;;) {
        const op = this.match('EQ') ? '==' : this.match('NEQ') ? '!=' : null
        if (op === null) return left
        left = this.node<Expr>({ kind: 'Binary', op, left, right: this.parseComparison() })
      }
    } finally {
      this.exit()
    }
  }

  private parseComparison(): Expr {
    this.enter()
    try {
      let left = this.parseAdditive()
      for (;;) {
        const op = this.match('LTE') ? '<=' : this.match('GTE') ? '>=' : this.match('LT') ? '<' : this.match('GT') ? '>' : null
        if (op === null) return left
        left = this.node<Expr>({ kind: 'Binary', op, left, right: this.parseAdditive() })
      }
    } finally {
      this.exit()
    }
  }

  private parseAdditive(): Expr {
    this.enter()
    try {
      let left = this.parseMultiplicative()
      for (;;) {
        const op = this.match('PLUS') ? '+' : this.match('MINUS') ? '-' : null
        if (op === null) return left
        left = this.node<Expr>({ kind: 'Binary', op, left, right: this.parseMultiplicative() })
      }
    } finally {
      this.exit()
    }
  }

  private parseMultiplicative(): Expr {
    this.enter()
    try {
      let left = this.parseUnary()
      for (;;) {
        const op = this.match('STAR') ? '*' : this.match('SLASH') ? '/' : this.match('PERCENT') ? '%' : null
        if (op === null) return left
        left = this.node<Expr>({ kind: 'Binary', op, left, right: this.parseUnary() })
      }
    } finally {
      this.exit()
    }
  }

  private parseUnary(): Expr {
    this.enter()
    try {
      if (this.match('NOT')) return this.node<Expr>({ kind: 'Unary', op: '!', operand: this.parseUnary() })
      if (this.match('MINUS')) return this.node<Expr>({ kind: 'Unary', op: '-', operand: this.parseUnary() })
      return this.parsePostfix()
    } finally {
      this.exit()
    }
  }

  private parsePostfix(): Expr {
    this.enter()
    try {
      let expr = this.parsePrimary()
      for (;;) {
        if (this.match('DOT')) {
          const name = this.expectIdentifierLike("'.' の後にはプロパティ名が必要です")
          expr = this.node<Expr>({ kind: 'Member', target: expr, name, nullSafe: false })
        } else if (this.match('QUESTION_DOT')) {
          const name = this.expectIdentifierLike("'?.' の後にはプロパティ名が必要です")
          expr = this.node<Expr>({ kind: 'Member', target: expr, name, nullSafe: true })
        } else if (this.match('LBRACKET')) {
          const idx = this.parseExpression()
          this.expect('RBRACKET', "']' が必要です")
          expr = this.node<Expr>({ kind: 'Index', target: expr, index: idx })
        } else if (this.check('LPAREN')) {
          // 呼び出せるのは組み込み関数だけ。式を callee にはできない。
          if (expr.kind !== 'Identifier') this.fail('関数呼び出しは組み込み関数名に対してのみ書けます')
          const callee = expr
          this.advance()
          const args: Expr[] = []
          if (!this.check('RPAREN')) {
            do {
              args.push(this.parseExpression())
            } while (this.match('COMMA'))
          }
          this.expect('RPAREN', "')' が必要です")
          expr = this.node<Expr>({ kind: 'Call', name: callee.name, args })
        } else {
          return expr
        }
      }
    } finally {
      this.exit()
    }
  }

  private parsePrimary(): Expr {
    this.enter()
    try {
      return this.parsePrimaryInner()
    } finally {
      this.exit()
    }
  }

  private parsePrimaryInner(): Expr {
    const token = this.current
    switch (token.type) {
      case 'NUMBER':
        this.advance()
        return this.node<Expr>({ kind: 'Literal', value: token.numberValue })
      case 'STRING':
        this.advance()
        return this.node<Expr>({ kind: 'Literal', value: token.stringValue })
      case 'TRUE':
        this.advance()
        return this.node<Expr>({ kind: 'Literal', value: true })
      case 'FALSE':
        this.advance()
        return this.node<Expr>({ kind: 'Literal', value: false })
      case 'NULL':
        this.advance()
        return this.node<Expr>({ kind: 'Literal', value: null })
      case 'IDENT':
        this.advance()
        return this.node<Expr>({ kind: 'Identifier', name: token.text })
      case 'LPAREN': {
        this.advance()
        const inner = this.parseExpression()
        this.expect('RPAREN', "')' が必要です")
        return inner
      }
      case 'LBRACKET': {
        this.advance()
        const items: Expr[] = []
        if (!this.check('RBRACKET')) {
          do {
            items.push(this.parseExpression())
          } while (this.match('COMMA'))
        }
        this.expect('RBRACKET', "']' が必要です")
        return this.node<Expr>({ kind: 'ArrayLit', items })
      }
      case 'LBRACE': {
        this.advance()
        const entries: [string, Expr][] = []
        if (!this.check('RBRACE')) {
          do {
            let key: string
            if (this.current.type === 'STRING') {
              key = this.current.stringValue
              this.advance()
            } else if (this.current.type === 'IDENT') {
              key = this.current.text
              this.advance()
            } else {
              this.fail('オブジェクトのキーは文字列または識別子です')
            }
            this.expect('COLON', "オブジェクトのキーの後には ':' が必要です")
            entries.push([key, this.parseExpression()])
          } while (this.match('COMMA'))
        }
        this.expect('RBRACE', "'}' が必要です")
        return this.node<Expr>({ kind: 'ObjectLit', entries })
      }
      default:
        return this.fail(`予期しないトークン '${token.text || '式の終端'}'`)
    }
  }

  // -- helpers -------------------------------------------------------------

  private enter() {
    this.depth++
    if (this.depth > MAX_DEPTH) {
      throw new ExprParseException({ code: 'E_DEPTH', message: `式のネストが上限 ${MAX_DEPTH} を超えました` })
    }
  }

  private exit() {
    this.depth--
  }

  private node<T>(expr: T): T {
    this.nodeCount++
    if (this.nodeCount > MAX_AST_NODES) {
      throw new ExprParseException({ code: 'E_DEPTH', message: `式の要素数が上限 ${MAX_AST_NODES} を超えました` })
    }
    return expr
  }

  private advance() {
    if (this.current.type !== 'EOF') this.index++
  }

  private check(type: TokenType): boolean {
    return this.current.type === type
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance()
      return true
    }
    return false
  }

  expect(type: TokenType, message: string) {
    if (!this.match(type)) this.fail(message)
  }

  /** `data.if` のように予約語と同じ綴りのプロパティ名も許す。 */
  private expectIdentifierLike(message: string): string {
    const token = this.current
    if (token.type === 'IDENT' || token.type === 'TRUE' || token.type === 'FALSE' || token.type === 'NULL') {
      this.advance()
      return token.text
    }
    return this.fail(message)
  }

  private fail(message: string): never {
    throw new ExprParseException({
      code: 'E_PARSE',
      message: `${message} (位置 ${this.current.position}, 式: ${this.source})`,
    })
  }
}

// ---------------------------------------------------------------------------
// キャッシュ
// ---------------------------------------------------------------------------

/**
 * 式文字列 -> AST のキャッシュ。
 *
 * ドキュメント読み込み時に全式をここに通しておくことで、パースエラーを
 * 一括検出しつつ描画中の再パースをなくす (docs/spec/expression.md §6)。
 */
export class ExprCache {
  private readonly entries = new Map<string, ReturnType<typeof tryParse>>()

  constructor(private readonly maxEntries = 512) {}

  get(source: string): ReturnType<typeof tryParse> {
    const cached = this.entries.get(source)
    if (cached !== undefined) {
      // LRU: 再アクセスされたエントリを最後尾に移す。
      this.entries.delete(source)
      this.entries.set(source, cached)
      return cached
    }
    const result = tryParse(source)
    this.entries.set(source, result)
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    return result
  }

  clear() {
    this.entries.clear()
  }
}
