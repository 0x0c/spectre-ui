package dev.spectre.core.expr

import dev.spectre.core.SpValue

/**
 * SpectreExpr の字句解析 + 再帰下降パーサ。
 *
 * 文法は docs/spec/expression.md §3 の EBNF に対応する。
 * パース結果は [ExprCache] でキャッシュされるため、同じ式文字列を再パースしない。
 */
object ExprParser {

    const val MAX_AST_NODES = 256
    const val MAX_DEPTH = 32

    fun parse(source: String): Expr {
        val tokens = Lexer(source).tokenize()
        val parser = Parser(tokens, source)
        val expr = parser.parseExpression()
        parser.expect(TokenType.EOF, "式の後に余分な文字があります")
        return expr
    }

    /** パースに失敗しても例外を投げず、エラーを返す形。 */
    fun tryParse(source: String): Result<Expr> = runCatching { parse(source) }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

internal enum class TokenType {
    NUMBER, STRING, IDENT,
    TRUE, FALSE, NULL,
    PLUS, MINUS, STAR, SLASH, PERCENT,
    EQ, NEQ, LT, LTE, GT, GTE,
    AND, OR, NOT,
    QUESTION, COLON, DOT, QUESTION_DOT, COMMA,
    LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE,
    EOF,
}

internal data class Token(
    val type: TokenType,
    val text: String,
    val position: Int,
    val numberValue: Double = 0.0,
    val stringValue: String = "",
)

internal class Lexer(private val source: String) {
    private var index = 0

    fun tokenize(): List<Token> {
        val tokens = ArrayList<Token>()
        while (true) {
            skipWhitespace()
            if (index >= source.length) {
                tokens.add(Token(TokenType.EOF, "", index))
                return tokens
            }
            tokens.add(nextToken())
        }
    }

    private fun skipWhitespace() {
        while (index < source.length && source[index].isWhitespace()) index++
    }

    private fun nextToken(): Token {
        val start = index
        val c = source[index]

        if (c.isDigit()) return number()
        if (c == '\'' || c == '"') return string(c)
        if (c.isLetter() || c == '_' || c == '$') return identifier()

        index++
        fun match(next: Char): Boolean {
            if (index < source.length && source[index] == next) { index++; return true }
            return false
        }

        return when (c) {
            '+' -> Token(TokenType.PLUS, "+", start)
            '-' -> Token(TokenType.MINUS, "-", start)
            '*' -> Token(TokenType.STAR, "*", start)
            '/' -> Token(TokenType.SLASH, "/", start)
            '%' -> Token(TokenType.PERCENT, "%", start)
            '(' -> Token(TokenType.LPAREN, "(", start)
            ')' -> Token(TokenType.RPAREN, ")", start)
            '[' -> Token(TokenType.LBRACKET, "[", start)
            ']' -> Token(TokenType.RBRACKET, "]", start)
            '{' -> Token(TokenType.LBRACE, "{", start)
            '}' -> Token(TokenType.RBRACE, "}", start)
            ',' -> Token(TokenType.COMMA, ",", start)
            '.' -> Token(TokenType.DOT, ".", start)
            ':' -> Token(TokenType.COLON, ":", start)
            '?' -> if (match('.')) Token(TokenType.QUESTION_DOT, "?.", start)
                   else Token(TokenType.QUESTION, "?", start)
            '=' -> if (match('=')) Token(TokenType.EQ, "==", start)
                   else fail("'=' 単体は使えません。比較は '==' です", start)
            '!' -> if (match('=')) Token(TokenType.NEQ, "!=", start)
                   else Token(TokenType.NOT, "!", start)
            '<' -> if (match('=')) Token(TokenType.LTE, "<=", start) else Token(TokenType.LT, "<", start)
            '>' -> if (match('=')) Token(TokenType.GTE, ">=", start) else Token(TokenType.GT, ">", start)
            '&' -> if (match('&')) Token(TokenType.AND, "&&", start)
                   else fail("'&' 単体は使えません。論理積は '&&' です", start)
            '|' -> if (match('|')) Token(TokenType.OR, "||", start)
                   else fail("'|' 単体は使えません。論理和は '||' です", start)
            else -> fail("解釈できない文字 '$c'", start)
        }
    }

    private fun number(): Token {
        val start = index
        while (index < source.length && source[index].isDigit()) index++
        if (index < source.length && source[index] == '.' &&
            index + 1 < source.length && source[index + 1].isDigit()
        ) {
            index++
            while (index < source.length && source[index].isDigit()) index++
        }
        val text = source.substring(start, index)
        val value = text.toDoubleOrNull() ?: fail("数値として解釈できません: $text", start)
        return Token(TokenType.NUMBER, text, start, numberValue = value)
    }

    private fun string(quote: Char): Token {
        val start = index
        index++ // 開きクォート
        val sb = StringBuilder()
        while (true) {
            if (index >= source.length) fail("文字列が閉じられていません", start)
            val ch = source[index]
            if (ch == quote) { index++; break }
            if (ch == '\\') {
                index++
                if (index >= source.length) fail("エスケープが不完全です", start)
                when (val esc = source[index]) {
                    'n' -> sb.append('\n')
                    't' -> sb.append('\t')
                    'r' -> sb.append('\r')
                    '\\' -> sb.append('\\')
                    '\'' -> sb.append('\'')
                    '"' -> sb.append('"')
                    else -> sb.append(esc)
                }
                index++
            } else {
                sb.append(ch)
                index++
            }
        }
        return Token(TokenType.STRING, source.substring(start, index), start, stringValue = sb.toString())
    }

    private fun identifier(): Token {
        val start = index
        while (index < source.length && (source[index].isLetterOrDigit() || source[index] == '_')) index++
        val text = source.substring(start, index)
        val type = when (text) {
            "true" -> TokenType.TRUE
            "false" -> TokenType.FALSE
            "null" -> TokenType.NULL
            else -> TokenType.IDENT
        }
        return Token(type, text, start)
    }

    private fun fail(message: String, position: Int): Nothing =
        throw ExprParseException(ExprError(ExprErrorCode.E_PARSE, "$message (位置 $position)"))
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

internal class Parser(private val tokens: List<Token>, private val source: String) {
    private var index = 0
    private var nodeCount = 0
    private var depth = 0

    private val current: Token get() = tokens[index]

    fun parseExpression(): Expr = parseTernary()

    private fun parseTernary(): Expr {
        enter()
        try {
            val condition = parseOr()
            if (!match(TokenType.QUESTION)) return condition
            val ifTrue = parseExpression()
            expect(TokenType.COLON, "三項演算子には ':' が必要です")
            val ifFalse = parseExpression()
            return node(Expr.Ternary(condition, ifTrue, ifFalse))
        } finally { exit() }
    }

    private fun parseOr(): Expr {
        enter()
        try {
            var left = parseAnd()
            while (match(TokenType.OR)) left = node(Expr.Binary("||", left, parseAnd()))
            return left
        } finally { exit() }
    }

    private fun parseAnd(): Expr {
        enter()
        try {
            var left = parseEquality()
            while (match(TokenType.AND)) left = node(Expr.Binary("&&", left, parseEquality()))
            return left
        } finally { exit() }
    }

    private fun parseEquality(): Expr {
        enter()
        try {
            var left = parseComparison()
            while (true) {
                val op = when {
                    match(TokenType.EQ) -> "=="
                    match(TokenType.NEQ) -> "!="
                    else -> return left
                }
                left = node(Expr.Binary(op, left, parseComparison()))
            }
        } finally { exit() }
    }

    private fun parseComparison(): Expr {
        enter()
        try {
            var left = parseAdditive()
            while (true) {
                val op = when {
                    match(TokenType.LTE) -> "<="
                    match(TokenType.GTE) -> ">="
                    match(TokenType.LT) -> "<"
                    match(TokenType.GT) -> ">"
                    else -> return left
                }
                left = node(Expr.Binary(op, left, parseAdditive()))
            }
        } finally { exit() }
    }

    private fun parseAdditive(): Expr {
        enter()
        try {
            var left = parseMultiplicative()
            while (true) {
                val op = when {
                    match(TokenType.PLUS) -> "+"
                    match(TokenType.MINUS) -> "-"
                    else -> return left
                }
                left = node(Expr.Binary(op, left, parseMultiplicative()))
            }
        } finally { exit() }
    }

    private fun parseMultiplicative(): Expr {
        enter()
        try {
            var left = parseUnary()
            while (true) {
                val op = when {
                    match(TokenType.STAR) -> "*"
                    match(TokenType.SLASH) -> "/"
                    match(TokenType.PERCENT) -> "%"
                    else -> return left
                }
                left = node(Expr.Binary(op, left, parseUnary()))
            }
        } finally { exit() }
    }

    private fun parseUnary(): Expr {
        enter()
        try {
            return when {
                match(TokenType.NOT) -> node(Expr.Unary("!", parseUnary()))
                match(TokenType.MINUS) -> node(Expr.Unary("-", parseUnary()))
                else -> parsePostfix()
            }
        } finally { exit() }
    }

    private fun parsePostfix(): Expr {
        enter()
        try {
            var expr = parsePrimary()
            while (true) {
                expr = when {
                    match(TokenType.DOT) -> {
                        val name = expectIdentifierLike("'.' の後にはプロパティ名が必要です")
                        node(Expr.Member(expr, name, nullSafe = false))
                    }
                    match(TokenType.QUESTION_DOT) -> {
                        val name = expectIdentifierLike("'?.' の後にはプロパティ名が必要です")
                        node(Expr.Member(expr, name, nullSafe = true))
                    }
                    match(TokenType.LBRACKET) -> {
                        val idx = parseExpression()
                        expect(TokenType.RBRACKET, "']' が必要です")
                        node(Expr.Index(expr, idx))
                    }
                    check(TokenType.LPAREN) -> {
                        // 呼び出せるのは組み込み関数だけ。式を callee にはできない。
                        val callee = expr as? Expr.Identifier
                            ?: fail("関数呼び出しは組み込み関数名に対してのみ書けます")
                        advance()
                        val args = ArrayList<Expr>()
                        if (!check(TokenType.RPAREN)) {
                            do { args.add(parseExpression()) } while (match(TokenType.COMMA))
                        }
                        expect(TokenType.RPAREN, "')' が必要です")
                        node(Expr.Call(callee.name, args))
                    }
                    else -> return expr
                }
            }
        } finally { exit() }
    }

    private fun parsePrimary(): Expr {
        enter()
        try {
            return parsePrimaryInner()
        } finally { exit() }
    }

    private fun parsePrimaryInner(): Expr {
        val token = current
        return when (token.type) {
            TokenType.NUMBER -> { advance(); node(Expr.Literal(SpValue.Num(token.numberValue))) }
            TokenType.STRING -> { advance(); node(Expr.Literal(SpValue.Str(token.stringValue))) }
            TokenType.TRUE -> { advance(); node(Expr.Literal(SpValue.Bool(true))) }
            TokenType.FALSE -> { advance(); node(Expr.Literal(SpValue.Bool(false))) }
            TokenType.NULL -> { advance(); node(Expr.Literal(SpValue.Null)) }
            TokenType.IDENT -> { advance(); node(Expr.Identifier(token.text)) }
            TokenType.LPAREN -> {
                advance()
                val inner = parseExpression()
                expect(TokenType.RPAREN, "')' が必要です")
                inner
            }
            TokenType.LBRACKET -> {
                advance()
                val items = ArrayList<Expr>()
                if (!check(TokenType.RBRACKET)) {
                    do { items.add(parseExpression()) } while (match(TokenType.COMMA))
                }
                expect(TokenType.RBRACKET, "']' が必要です")
                node(Expr.ArrayLit(items))
            }
            TokenType.LBRACE -> {
                advance()
                val entries = ArrayList<Pair<String, Expr>>()
                if (!check(TokenType.RBRACE)) {
                    do {
                        val key = when (current.type) {
                            TokenType.STRING -> current.stringValue.also { advance() }
                            TokenType.IDENT -> current.text.also { advance() }
                            else -> fail("オブジェクトのキーは文字列または識別子です")
                        }
                        expect(TokenType.COLON, "オブジェクトのキーの後には ':' が必要です")
                        entries.add(key to parseExpression())
                    } while (match(TokenType.COMMA))
                }
                expect(TokenType.RBRACE, "'}' が必要です")
                node(Expr.ObjectLit(entries))
            }
            else -> fail("予期しないトークン '${token.text.ifEmpty { "式の終端" }}'")
        }
    }

    // -- helpers -------------------------------------------------------------

    private fun enter() {
        depth++
        if (depth > ExprParser.MAX_DEPTH) {
            throw ExprParseException(
                ExprError(ExprErrorCode.E_DEPTH, "式のネストが上限 ${ExprParser.MAX_DEPTH} を超えました")
            )
        }
    }

    private fun exit() { depth-- }

    private fun <T : Expr> node(expr: T): T {
        nodeCount++
        if (nodeCount > ExprParser.MAX_AST_NODES) {
            throw ExprParseException(
                ExprError(ExprErrorCode.E_DEPTH, "式の要素数が上限 ${ExprParser.MAX_AST_NODES} を超えました")
            )
        }
        return expr
    }

    private fun advance() { if (current.type != TokenType.EOF) index++ }

    private fun check(type: TokenType): Boolean = current.type == type

    private fun match(type: TokenType): Boolean {
        if (check(type)) { advance(); return true }
        return false
    }

    fun expect(type: TokenType, message: String) {
        if (!match(type)) fail(message)
    }

    /** `data.if` のように予約語と同じ綴りのプロパティ名も許す。 */
    private fun expectIdentifierLike(message: String): String {
        val token = current
        return when (token.type) {
            TokenType.IDENT, TokenType.TRUE, TokenType.FALSE, TokenType.NULL -> {
                advance(); token.text
            }
            else -> fail(message)
        }
    }

    private fun fail(message: String): Nothing = throw ExprParseException(
        ExprError(ExprErrorCode.E_PARSE, "$message (位置 ${current.position}, 式: $source)")
    )
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
class ExprCache(private val maxEntries: Int = 512) {
    private val entries = object : LinkedHashMap<String, Result<Expr>>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Result<Expr>>): Boolean =
            size > maxEntries
    }

    fun get(source: String): Result<Expr> =
        entries.getOrPut(source) { ExprParser.tryParse(source) }

    fun clear() = entries.clear()
}
