import Foundation

/// SpectreExpr の抽象構文木。
///
/// ラムダ・関数定義・代入・ループを持たないため、評価は AST のサイズに比例した
/// 有限時間で必ず停止する (docs/spec/expression.md §3)。
public indirect enum Expr: Equatable, Sendable {
    case literal(SpValue)
    case identifier(String)
    case member(target: Expr, name: String, nullSafe: Bool)
    case index(target: Expr, index: Expr)
    /// 呼び出せるのは組み込み関数だけ。任意の式を callee にはできない。
    case call(name: String, args: [Expr])
    case unary(op: String, operand: Expr)
    case binary(op: String, left: Expr, right: Expr)
    case ternary(condition: Expr, ifTrue: Expr, ifFalse: Expr)
    case arrayLiteral([Expr])
    case objectLiteral([(String, Expr)])

    public static func == (lhs: Expr, rhs: Expr) -> Bool {
        switch (lhs, rhs) {
        case (.literal(let a), .literal(let b)): return a == b
        case (.identifier(let a), .identifier(let b)): return a == b
        case (.member(let t1, let n1, let s1), .member(let t2, let n2, let s2)):
            return t1 == t2 && n1 == n2 && s1 == s2
        case (.index(let t1, let i1), .index(let t2, let i2)): return t1 == t2 && i1 == i2
        case (.call(let n1, let a1), .call(let n2, let a2)): return n1 == n2 && a1 == a2
        case (.unary(let o1, let e1), .unary(let o2, let e2)): return o1 == o2 && e1 == e2
        case (.binary(let o1, let l1, let r1), .binary(let o2, let l2, let r2)):
            return o1 == o2 && l1 == l2 && r1 == r2
        case (.ternary(let c1, let t1, let f1), .ternary(let c2, let t2, let f2)):
            return c1 == c2 && t1 == t2 && f1 == f2
        case (.arrayLiteral(let a), .arrayLiteral(let b)): return a == b
        case (.objectLiteral(let a), .objectLiteral(let b)):
            return a.count == b.count && zip(a, b).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
        default: return false
        }
    }
}

public enum ExprErrorCode: String, Sendable {
    case parse = "E_PARSE"
    case type = "E_TYPE"
    case unknownFunction = "E_UNKNOWN_FN"
    case depth = "E_DEPTH"
}

public struct ExprError: Error, Equatable, Sendable {
    public let code: ExprErrorCode
    public let message: String

    public init(_ code: ExprErrorCode, _ message: String) {
        self.code = code
        self.message = message
    }
}

// MARK: - 依存パスの抽出

public extension Expr {
    /// この式が参照しているスコープ相対パスの集合 (`state.form.email` など)。
    ///
    /// Store の変更時に、影響を受けるノードだけを再解決するために使う。
    /// 動的な添字 (`arr[state.i]`) を含む枝はその手前までのパスに丸める —
    /// 過剰に再解決されることはあっても、取りこぼしは起きない側に倒している。
    func dependencies() -> Set<String> {
        var out = Set<String>()
        Expr.collect(self, into: &out)
        return out
    }

    private static func collect(_ expr: Expr, into out: inout Set<String>) {
        let path = staticPath(of: expr)
        if let path { out.insert(path) }

        switch expr {
        case .literal, .identifier:
            break
        case .member(let target, _, _):
            if path == nil { collect(target, into: &out) }
        case .index(let target, let index):
            if path == nil { collect(target, into: &out) }
            collect(index, into: &out)
        case .call(_, let args):
            args.forEach { collect($0, into: &out) }
        case .unary(_, let operand):
            collect(operand, into: &out)
        case .binary(_, let left, let right):
            collect(left, into: &out)
            collect(right, into: &out)
        case .ternary(let condition, let ifTrue, let ifFalse):
            collect(condition, into: &out)
            collect(ifTrue, into: &out)
            collect(ifFalse, into: &out)
        case .arrayLiteral(let items):
            items.forEach { collect($0, into: &out) }
        case .objectLiteral(let entries):
            entries.forEach { collect($0.1, into: &out) }
        }
    }

    /// `data.a.b` のような静的に決まるパスを返す。決まらなければ nil。
    private static func staticPath(of expr: Expr) -> String? {
        switch expr {
        case .identifier(let name):
            return name
        case .member(let target, let name, _):
            guard let base = staticPath(of: target) else { return nil }
            return "\(base).\(name)"
        case .index(let target, let index):
            guard case .literal(.string(let key)) = index,
                  let base = staticPath(of: target) else { return nil }
            return "\(base).\(key)"
        default:
            return nil
        }
    }
}
