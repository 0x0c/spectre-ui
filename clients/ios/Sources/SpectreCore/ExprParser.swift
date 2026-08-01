import Foundation

/// SpectreExpr の字句解析 + 再帰下降パーサ。
///
/// 文法は docs/spec/expression.md §3 の EBNF に対応する。
/// Kotlin 実装 (`ExprParser.kt`) と同じ構造にしてあり、差分が出た場合は
/// spec/conformance/expr のコーパスが検出する。
public enum ExprParser {

    public static let maxASTNodes = 256
    public static let maxDepth = 32

    public static func parse(_ source: String) throws -> Expr {
        // tokenize() は mutating なので一時値には呼べない。変数に受けてから呼ぶ。
        var lexer = Lexer(source)
        let tokens = try lexer.tokenize()
        let parser = Parser(tokens: tokens, source: source)
        let expr = try parser.parseExpression()
        try parser.expect(.eof, "式の後に余分な文字があります")
        return expr
    }
}

// MARK: - Lexer

enum TokenType {
    case number, string, ident
    case trueKeyword, falseKeyword, nullKeyword
    case plus, minus, star, slash, percent
    case eq, neq, lt, lte, gt, gte
    case and, or, not
    case question, colon, dot, questionDot, comma
    case lparen, rparen, lbracket, rbracket, lbrace, rbrace
    case eof
}

struct Token {
    let type: TokenType
    let text: String
    let position: Int
    var numberValue: Double = 0
    var stringValue: String = ""
}

struct Lexer {
    private let scalars: [Character]
    private var index = 0

    init(_ source: String) {
        self.scalars = Array(source)
    }

    mutating func tokenize() throws -> [Token] {
        var tokens: [Token] = []
        while true {
            skipWhitespace()
            if index >= scalars.count {
                tokens.append(Token(type: .eof, text: "", position: index))
                return tokens
            }
            tokens.append(try nextToken())
        }
    }

    private mutating func skipWhitespace() {
        while index < scalars.count, scalars[index].isWhitespace { index += 1 }
    }

    private mutating func nextToken() throws -> Token {
        let start = index
        let c = scalars[index]

        if c.isNumber { return try number() }
        if c == "'" || c == "\"" { return try string(quote: c) }
        if c.isLetter || c == "_" || c == "$" { return identifier() }

        index += 1
        func match(_ next: Character) -> Bool {
            if index < scalars.count, scalars[index] == next { index += 1; return true }
            return false
        }

        switch c {
        case "+": return Token(type: .plus, text: "+", position: start)
        case "-": return Token(type: .minus, text: "-", position: start)
        case "*": return Token(type: .star, text: "*", position: start)
        case "/": return Token(type: .slash, text: "/", position: start)
        case "%": return Token(type: .percent, text: "%", position: start)
        case "(": return Token(type: .lparen, text: "(", position: start)
        case ")": return Token(type: .rparen, text: ")", position: start)
        case "[": return Token(type: .lbracket, text: "[", position: start)
        case "]": return Token(type: .rbracket, text: "]", position: start)
        case "{": return Token(type: .lbrace, text: "{", position: start)
        case "}": return Token(type: .rbrace, text: "}", position: start)
        case ",": return Token(type: .comma, text: ",", position: start)
        case ".": return Token(type: .dot, text: ".", position: start)
        case ":": return Token(type: .colon, text: ":", position: start)
        case "?":
            return match(".")
                ? Token(type: .questionDot, text: "?.", position: start)
                : Token(type: .question, text: "?", position: start)
        case "=":
            guard match("=") else {
                throw ExprError(.parse, "'=' 単体は使えません。比較は '==' です (位置 \(start))")
            }
            return Token(type: .eq, text: "==", position: start)
        case "!":
            return match("=")
                ? Token(type: .neq, text: "!=", position: start)
                : Token(type: .not, text: "!", position: start)
        case "<":
            return match("=")
                ? Token(type: .lte, text: "<=", position: start)
                : Token(type: .lt, text: "<", position: start)
        case ">":
            return match("=")
                ? Token(type: .gte, text: ">=", position: start)
                : Token(type: .gt, text: ">", position: start)
        case "&":
            guard match("&") else {
                throw ExprError(.parse, "'&' 単体は使えません。論理積は '&&' です (位置 \(start))")
            }
            return Token(type: .and, text: "&&", position: start)
        case "|":
            guard match("|") else {
                throw ExprError(.parse, "'|' 単体は使えません。論理和は '||' です (位置 \(start))")
            }
            return Token(type: .or, text: "||", position: start)
        default:
            throw ExprError(.parse, "解釈できない文字 '\(c)' (位置 \(start))")
        }
    }

    private mutating func number() throws -> Token {
        let start = index
        while index < scalars.count, scalars[index].isNumber { index += 1 }
        if index < scalars.count, scalars[index] == ".",
           index + 1 < scalars.count, scalars[index + 1].isNumber {
            index += 1
            while index < scalars.count, scalars[index].isNumber { index += 1 }
        }
        let text = String(scalars[start..<index])
        guard let value = Double(text) else {
            throw ExprError(.parse, "数値として解釈できません: \(text)")
        }
        return Token(type: .number, text: text, position: start, numberValue: value)
    }

    private mutating func string(quote: Character) throws -> Token {
        let start = index
        index += 1 // 開きクォート
        var out = ""
        while true {
            guard index < scalars.count else {
                throw ExprError(.parse, "文字列が閉じられていません (位置 \(start))")
            }
            let ch = scalars[index]
            if ch == quote { index += 1; break }
            if ch == "\\" {
                index += 1
                guard index < scalars.count else {
                    throw ExprError(.parse, "エスケープが不完全です (位置 \(start))")
                }
                switch scalars[index] {
                case "n": out.append("\n")
                case "t": out.append("\t")
                case "r": out.append("\r")
                case "\\": out.append("\\")
                case "'": out.append("'")
                case "\"": out.append("\"")
                case let other: out.append(other)
                }
                index += 1
            } else {
                out.append(ch)
                index += 1
            }
        }
        return Token(
            type: .string,
            text: String(scalars[start..<index]),
            position: start,
            stringValue: out
        )
    }

    private mutating func identifier() -> Token {
        let start = index
        while index < scalars.count, scalars[index].isLetter || scalars[index].isNumber || scalars[index] == "_" {
            index += 1
        }
        let text = String(scalars[start..<index])
        let type: TokenType
        switch text {
        case "true": type = .trueKeyword
        case "false": type = .falseKeyword
        case "null": type = .nullKeyword
        default: type = .ident
        }
        return Token(type: type, text: text, position: start)
    }
}

// MARK: - Parser

final class Parser {
    private let tokens: [Token]
    private let source: String
    private var index = 0
    private var nodeCount = 0
    private var depth = 0

    init(tokens: [Token], source: String) {
        self.tokens = tokens
        self.source = source
    }

    private var current: Token { tokens[index] }

    func parseExpression() throws -> Expr { try parseTernary() }

    private func parseTernary() throws -> Expr {
        try enter(); defer { exit() }
        let condition = try parseOr()
        guard match(.question) else { return condition }
        let ifTrue = try parseExpression()
        try expect(.colon, "三項演算子には ':' が必要です")
        let ifFalse = try parseExpression()
        return try node(.ternary(condition: condition, ifTrue: ifTrue, ifFalse: ifFalse))
    }

    private func parseOr() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseAnd()
        while match(.or) {
            left = try node(.binary(op: "||", left: left, right: try parseAnd()))
        }
        return left
    }

    private func parseAnd() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseEquality()
        while match(.and) {
            left = try node(.binary(op: "&&", left: left, right: try parseEquality()))
        }
        return left
    }

    private func parseEquality() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseComparison()
        while true {
            let op: String
            if match(.eq) { op = "==" } else if match(.neq) { op = "!=" } else { return left }
            left = try node(.binary(op: op, left: left, right: try parseComparison()))
        }
    }

    private func parseComparison() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseAdditive()
        while true {
            let op: String
            if match(.lte) { op = "<=" }
            else if match(.gte) { op = ">=" }
            else if match(.lt) { op = "<" }
            else if match(.gt) { op = ">" }
            else { return left }
            left = try node(.binary(op: op, left: left, right: try parseAdditive()))
        }
    }

    private func parseAdditive() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseMultiplicative()
        while true {
            let op: String
            if match(.plus) { op = "+" } else if match(.minus) { op = "-" } else { return left }
            left = try node(.binary(op: op, left: left, right: try parseMultiplicative()))
        }
    }

    private func parseMultiplicative() throws -> Expr {
        try enter(); defer { exit() }
        var left = try parseUnary()
        while true {
            let op: String
            if match(.star) { op = "*" }
            else if match(.slash) { op = "/" }
            else if match(.percent) { op = "%" }
            else { return left }
            left = try node(.binary(op: op, left: left, right: try parseUnary()))
        }
    }

    private func parseUnary() throws -> Expr {
        try enter(); defer { exit() }
        if match(.not) { return try node(.unary(op: "!", operand: try parseUnary())) }
        if match(.minus) { return try node(.unary(op: "-", operand: try parseUnary())) }
        return try parsePostfix()
    }

    private func parsePostfix() throws -> Expr {
        try enter(); defer { exit() }
        var expr = try parsePrimary()
        while true {
            if match(.dot) {
                let name = try expectIdentifierLike("'.' の後にはプロパティ名が必要です")
                expr = try node(.member(target: expr, name: name, nullSafe: false))
            } else if match(.questionDot) {
                let name = try expectIdentifierLike("'?.' の後にはプロパティ名が必要です")
                expr = try node(.member(target: expr, name: name, nullSafe: true))
            } else if match(.lbracket) {
                let idx = try parseExpression()
                try expect(.rbracket, "']' が必要です")
                expr = try node(.index(target: expr, index: idx))
            } else if check(.lparen) {
                // 呼び出せるのは組み込み関数だけ。式を callee にはできない。
                guard case .identifier(let calleeName) = expr else {
                    throw fail("関数呼び出しは組み込み関数名に対してのみ書けます")
                }
                advance()
                var args: [Expr] = []
                if !check(.rparen) {
                    repeat { args.append(try parseExpression()) } while match(.comma)
                }
                try expect(.rparen, "')' が必要です")
                expr = try node(.call(name: calleeName, args: args))
            } else {
                return expr
            }
        }
    }

    private func parsePrimary() throws -> Expr {
        try enter(); defer { exit() }
        let token = current
        switch token.type {
        case .number:
            advance(); return try node(.literal(.number(token.numberValue)))
        case .string:
            advance(); return try node(.literal(.string(token.stringValue)))
        case .trueKeyword:
            advance(); return try node(.literal(.bool(true)))
        case .falseKeyword:
            advance(); return try node(.literal(.bool(false)))
        case .nullKeyword:
            advance(); return try node(.literal(.null))
        case .ident:
            advance(); return try node(.identifier(token.text))
        case .lparen:
            advance()
            let inner = try parseExpression()
            try expect(.rparen, "')' が必要です")
            return inner
        case .lbracket:
            advance()
            var items: [Expr] = []
            if !check(.rbracket) {
                repeat { items.append(try parseExpression()) } while match(.comma)
            }
            try expect(.rbracket, "']' が必要です")
            return try node(.arrayLiteral(items))
        case .lbrace:
            advance()
            var entries: [(String, Expr)] = []
            if !check(.rbrace) {
                repeat {
                    let key: String
                    switch current.type {
                    case .string: key = current.stringValue; advance()
                    case .ident: key = current.text; advance()
                    default: throw fail("オブジェクトのキーは文字列または識別子です")
                    }
                    try expect(.colon, "オブジェクトのキーの後には ':' が必要です")
                    entries.append((key, try parseExpression()))
                } while match(.comma)
            }
            try expect(.rbrace, "'}' が必要です")
            return try node(.objectLiteral(entries))
        default:
            throw fail("予期しないトークン '\(token.text.isEmpty ? "式の終端" : token.text)'")
        }
    }

    // MARK: helpers

    private func enter() throws {
        depth += 1
        if depth > ExprParser.maxDepth {
            throw ExprError(.depth, "式のネストが上限 \(ExprParser.maxDepth) を超えました")
        }
    }

    private func exit() { depth -= 1 }

    private func node(_ expr: Expr) throws -> Expr {
        nodeCount += 1
        if nodeCount > ExprParser.maxASTNodes {
            throw ExprError(.depth, "式の要素数が上限 \(ExprParser.maxASTNodes) を超えました")
        }
        return expr
    }

    private func advance() { if current.type != .eof { index += 1 } }

    private func check(_ type: TokenType) -> Bool { current.type == type }

    private func match(_ type: TokenType) -> Bool {
        if check(type) { advance(); return true }
        return false
    }

    func expect(_ type: TokenType, _ message: String) throws {
        guard match(type) else { throw fail(message) }
    }

    /// `data.if` のように予約語と同じ綴りのプロパティ名も許す。
    private func expectIdentifierLike(_ message: String) throws -> String {
        let token = current
        switch token.type {
        case .ident, .trueKeyword, .falseKeyword, .nullKeyword:
            advance()
            return token.text
        default:
            throw fail(message)
        }
    }

    private func fail(_ message: String) -> ExprError {
        ExprError(.parse, "\(message) (位置 \(current.position), 式: \(source))")
    }
}

/// 式文字列 -> AST のキャッシュ。
///
/// ドキュメント読み込み時に全式をここに通しておくことで、パースエラーを
/// 一括検出しつつ描画中の再パースをなくす (docs/spec/expression.md §6)。
public final class ExprCache {
    private var entries: [String: Result<Expr, ExprError>] = [:]
    private let maxEntries: Int

    public init(maxEntries: Int = 512) {
        self.maxEntries = maxEntries
    }

    public func get(_ source: String) -> Result<Expr, ExprError> {
        if let cached = entries[source] { return cached }
        let result: Result<Expr, ExprError>
        do {
            result = .success(try ExprParser.parse(source))
        } catch let error as ExprError {
            result = .failure(error)
        } catch {
            result = .failure(ExprError(.parse, error.localizedDescription))
        }
        // 単純な上限。LRU にするほどの規模ではない (1画面あたり数十〜数百式)
        if entries.count >= maxEntries { entries.removeAll(keepingCapacity: true) }
        entries[source] = result
        return result
    }

    public func clear() { entries.removeAll() }
}
