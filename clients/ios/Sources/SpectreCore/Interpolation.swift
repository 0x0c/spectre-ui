import Foundation

/// `${...}` を含む文字列テンプレート。
///
/// 文字列全体がちょうど1つの `${...}` なら `.whole` になり、評価結果の型が保存される。
/// それ以外は `.mixed` で、各部分を文字列化して連結する (docs/spec/expression.md §1)。
public enum Template: Sendable {
    /// 補間を含まない素の文字列。
    case literal(String)
    /// 文字列全体がひとつの式。型が保存される。
    case whole(String)
    case mixed([Part])

    public enum Part: Sendable {
        case text(String)
        case expression(String)
    }
}

public enum TemplateParser {

    /// テンプレート文字列を解析する。`$${` はリテラルの `${` へのエスケープ。
    public static func parse(_ source: String) -> Template {
        guard source.contains("$") else { return .literal(source) }

        let chars = Array(source)
        var parts: [Template.Part] = []
        var text = ""
        var i = 0

        func flushText() {
            if !text.isEmpty {
                parts.append(.text(text))
                text = ""
            }
        }

        while i < chars.count {
            let c = chars[i]
            if c == "$", i + 2 < chars.count, chars[i + 1] == "$", chars[i + 2] == "{" {
                text += "${"
                i += 3
                continue
            }
            if c == "$", i + 1 < chars.count, chars[i + 1] == "{" {
                guard let end = findClosingBrace(chars, from: i + 2) else {
                    // 閉じられていない '${' はリテラルとして扱う。ここで例外にすると
                    // 「$1,000 のような文字列を書いたら画面が落ちる」ことになる。
                    text += String(chars[i...])
                    break
                }
                flushText()
                parts.append(.expression(String(chars[(i + 2)..<end])))
                i = end + 1
                continue
            }
            text.append(c)
            i += 1
        }
        flushText()

        if parts.isEmpty { return .literal("") }
        if parts.count == 1, case .expression(let source) = parts[0] { return .whole(source) }
        if parts.allSatisfy({ if case .text = $0 { return true }; return false }) {
            let joined = parts.map { part -> String in
                if case .text(let t) = part { return t }
                return ""
            }.joined()
            return .literal(joined)
        }
        return .mixed(parts)
    }

    /// `${` に対応する `}` の位置を返す。
    /// 式の中のオブジェクトリテラル `{...}` と文字列リテラル内の `}` を正しく読み飛ばす。
    private static func findClosingBrace(_ chars: [Character], from start: Int) -> Int? {
        var depth = 0
        var i = start
        while i < chars.count {
            let c = chars[i]
            if c == "'" || c == "\"" {
                i += 1
                while i < chars.count, chars[i] != c {
                    if chars[i] == "\\" { i += 1 }
                    i += 1
                }
            } else if c == "{" {
                depth += 1
            } else if c == "}" {
                if depth == 0 { return i }
                depth -= 1
            }
            i += 1
        }
        return nil
    }
}

/// テンプレートの評価。式のパースは `ExprCache` を通すため、同じ文字列の再パースは起きない。
public final class TemplateEvaluator {
    private let cache: ExprCache
    private let evaluator: ExprEvaluator
    private var templates: [String: Template] = [:]

    public init(cache: ExprCache = ExprCache(), evaluator: ExprEvaluator = ExprEvaluator()) {
        self.cache = cache
        self.evaluator = evaluator
    }

    public func template(for source: String) -> Template {
        if let cached = templates[source] { return cached }
        let parsed = TemplateParser.parse(source)
        templates[source] = parsed
        return parsed
    }

    public func evaluate(_ source: String, scope: EvalScope) -> EvalResult {
        evaluate(template(for: source), scope: scope)
    }

    public func evaluate(_ template: Template, scope: EvalScope) -> EvalResult {
        switch template {
        case .literal(let text):
            return EvalResult(.string(text))

        case .whole(let source):
            return evaluateExpression(source, scope: scope)

        case .mixed(let parts):
            var errors: [ExprError] = []
            var out = ""
            for part in parts {
                switch part {
                case .text(let text):
                    out += text
                case .expression(let source):
                    let result = evaluateExpression(source, scope: scope)
                    errors.append(contentsOf: result.errors)
                    out += result.value.stringify()
                }
            }
            return EvalResult(.string(out), errors)
        }
    }

    private func evaluateExpression(_ source: String, scope: EvalScope) -> EvalResult {
        switch cache.get(source) {
        case .success(let expr):
            return evaluator.evaluate(expr, scope: scope)
        case .failure(let error):
            return EvalResult(.null, [error])
        }
    }

    /// ドキュメント読み込み時に全式を事前解析し、パースエラーを一括検出する。
    public func precompile(_ source: String) -> [ExprError] {
        var errors: [ExprError] = []
        func check(_ exprSource: String) {
            if case .failure(let error) = cache.get(exprSource) { errors.append(error) }
        }
        switch template(for: source) {
        case .literal:
            break
        case .whole(let s):
            check(s)
        case .mixed(let parts):
            for part in parts {
                if case .expression(let s) = part { check(s) }
            }
        }
        return errors
    }

    /// この文字列が依存するスコープ相対パスの集合。差分再解決に使う。
    public func dependencies(_ source: String) -> Set<String> {
        var out = Set<String>()
        func collect(_ exprSource: String) {
            if case .success(let expr) = cache.get(exprSource) {
                out.formUnion(expr.dependencies())
            }
        }
        switch template(for: source) {
        case .literal:
            break
        case .whole(let s):
            collect(s)
        case .mixed(let parts):
            for part in parts {
                if case .expression(let s) = part { collect(s) }
            }
        }
        return out
    }
}
