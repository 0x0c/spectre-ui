import Foundation

/// 式評価のスコープ。
///
/// `data` は不変、`state` は可変、`item`/`index` は repeat の内側でのみ導入される。
/// `error` は request の onError ハンドラ内でのみ存在する。
public struct EvalScope: Sendable {
    public var data: SpValue
    public var state: SpValue
    public var env: SpValue
    public var locals: [String: SpValue]

    public init(
        data: SpValue = .emptyObject,
        state: SpValue = .emptyObject,
        env: SpValue = .emptyObject,
        locals: [String: SpValue] = [:]
    ) {
        self.data = data
        self.state = state
        self.env = env
        self.locals = locals
    }

    public func withLocals(_ extra: [String: SpValue]) -> EvalScope {
        var copy = self
        copy.locals = locals.merging(extra) { _, new in new }
        return copy
    }

    func lookup(_ name: String) -> SpValue? {
        switch name {
        case "data": return data
        case "state": return state
        case "env": return env
        default: return locals[name]
        }
    }
}

public struct EvalResult: Sendable {
    public let value: SpValue
    public let errors: [ExprError]

    public init(_ value: SpValue, _ errors: [ExprError] = []) {
        self.value = value
        self.errors = errors
    }

    public var hasError: Bool { !errors.isEmpty }
}

/// SpectreExpr の評価器。
///
/// 評価は例外を投げない。エラーは値 `.null` と `ExprError` の記録として現れる
/// (docs/spec/expression.md §5)。壊れた式で画面全体が落ちるより、その部分だけが
/// 空になるほうが害が小さいという判断。
public struct ExprEvaluator {
    private let functions: BuiltinFunctions

    public init(functions: BuiltinFunctions = BuiltinFunctions()) {
        self.functions = functions
    }

    public func evaluate(_ expr: Expr, scope: EvalScope) -> EvalResult {
        var errors: [ExprError] = []
        let value = eval(expr, scope, &errors)
        return EvalResult(value, errors)
    }

    private func eval(_ expr: Expr, _ scope: EvalScope, _ errors: inout [ExprError]) -> SpValue {
        switch expr {
        case .literal(let value):
            return value

        case .identifier(let name):
            return scope.lookup(name) ?? .null

        case .member(let target, let name, _):
            // null や非オブジェクトへのアクセスは null。'.' と '?.' の動作は同じで、
            // '?.' は読み手に意図を伝えるための糖衣構文 (docs/spec/expression.md §3)。
            guard case .object(let entries) = eval(target, scope, &errors) else { return .null }
            return entries[name] ?? .null

        case .index(let target, let indexExpr):
            let base = eval(target, scope, &errors)
            let idx = eval(indexExpr, scope, &errors)
            switch (base, idx) {
            case (.array(let items), .number(let n)):
                let i = Int(n)
                return (i >= 0 && i < items.count) ? items[i] : .null
            case (.object(let entries), .string(let key)):
                return entries[key] ?? .null
            case (.string(let s), .number(let n)):
                let chars = Array(s)
                let i = Int(n)
                return (i >= 0 && i < chars.count) ? .string(String(chars[i])) : .null
            default:
                return .null
            }

        case .call(let name, let args):
            let evaluated = args.map { eval($0, scope, &errors) }
            return functions.invoke(name: name, args: evaluated, scope: scope, errors: &errors)

        case .unary(let op, let operand):
            switch op {
            case "!":
                return .bool(!eval(operand, scope, &errors).isTruthy)
            case "-":
                guard case .number(let v) = eval(operand, scope, &errors) else {
                    return typeError(&errors, "単項 '-' は数値にのみ適用できます")
                }
                return .number(-v)
            default:
                return typeError(&errors, "未知の単項演算子 '\(op)'")
            }

        case .binary(let op, let left, let right):
            return evalBinary(op, left, right, scope, &errors)

        case .ternary(let condition, let ifTrue, let ifFalse):
            return eval(condition, scope, &errors).isTruthy
                ? eval(ifTrue, scope, &errors)
                : eval(ifFalse, scope, &errors)

        case .arrayLiteral(let items):
            return .array(items.map { eval($0, scope, &errors) })

        case .objectLiteral(let pairs):
            var entries: [String: SpValue] = [:]
            for (key, valueExpr) in pairs { entries[key] = eval(valueExpr, scope, &errors) }
            return .object(entries)
        }
    }

    private func evalBinary(
        _ op: String,
        _ leftExpr: Expr,
        _ rightExpr: Expr,
        _ scope: EvalScope,
        _ errors: inout [ExprError]
    ) -> SpValue {
        // && と || は短絡評価する。右辺は必要になるまで評価しない。
        if op == "&&" {
            let left = eval(leftExpr, scope, &errors)
            if !left.isTruthy { return .bool(false) }
            return .bool(eval(rightExpr, scope, &errors).isTruthy)
        }
        if op == "||" {
            let left = eval(leftExpr, scope, &errors)
            if left.isTruthy { return .bool(true) }
            return .bool(eval(rightExpr, scope, &errors).isTruthy)
        }

        let l = eval(leftExpr, scope, &errors)
        let r = eval(rightExpr, scope, &errors)

        switch op {
        case "==": return .bool(l == r)
        case "!=": return .bool(l != r)

        case "+":
            if case .number(let a) = l, case .number(let b) = r { return .number(a + b) }
            // どちらかが文字列なら連結。数値との連結は日常的に必要なため許す。
            let leftText = l.asString != nil, leftNumber = l.asDouble != nil
            let rightText = r.asString != nil, rightNumber = r.asDouble != nil
            if (leftText && (rightText || rightNumber)) || (leftNumber && rightText) {
                return .string(l.stringify() + r.stringify())
            }
            return typeError(&errors, "'+' は数値同士か、文字列と数値/文字列にのみ適用できます")

        case "-", "*", "/", "%":
            guard case .number(let a) = l, case .number(let b) = r else {
                return typeError(&errors, "'\(op)' は数値にのみ適用できます")
            }
            if (op == "/" || op == "%") && b == 0 {
                // 0 除算は例外にせず null。表示が空になるだけで画面は壊れない。
                return typeError(&errors, "0 で除算しました")
            }
            switch op {
            case "-": return .number(a - b)
            case "*": return .number(a * b)
            case "/": return .number(a / b)
            default: return .number(a.truncatingRemainder(dividingBy: b))
            }

        case "<", "<=", ">", ">=":
            return compare(l, r, op, &errors)

        default:
            return typeError(&errors, "未知の二項演算子 '\(op)'")
        }
    }

    private func compare(
        _ l: SpValue,
        _ r: SpValue,
        _ op: String,
        _ errors: inout [ExprError]
    ) -> SpValue {
        let ordering: Int
        switch (l, r) {
        case (.number(let a), .number(let b)):
            ordering = a < b ? -1 : (a > b ? 1 : 0)
        case (.string(let a), .string(let b)):
            ordering = a < b ? -1 : (a > b ? 1 : 0)
        default:
            return typeError(&errors, "'\(op)' は同じ型 (数値同士・文字列同士) にのみ適用できます")
        }
        switch op {
        case "<": return .bool(ordering < 0)
        case "<=": return .bool(ordering <= 0)
        case ">": return .bool(ordering > 0)
        default: return .bool(ordering >= 0)
        }
    }

    private func typeError(_ errors: inout [ExprError], _ message: String) -> SpValue {
        errors.append(ExprError(.type, message))
        return .null
    }
}
