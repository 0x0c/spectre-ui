import Foundation

/// 組み込み関数のホワイトリスト。
///
/// ユーザ定義関数もラムダも存在しないため、ここに列挙された関数がクライアントで
/// 実行されうる処理のすべてになる (docs/spec/expression.md §4)。
///
/// `map` / `filter` / `reduce` を意図的に持たない。それらはラムダを要求して言語を
/// 一気に大きくするため、配列の加工はサーバ側で行い `data` に入れて送る。
public struct BuiltinFunctions {

    public init() {}

    public func invoke(
        name: String,
        args: [SpValue],
        scope: EvalScope,
        errors: inout [ExprError]
    ) -> SpValue {
        let ctx = Ctx(name: name, args: args, scope: scope)

        switch name {
        // MARK: 文字列
        case "len", "count":
            guard ctx.arity(1, &errors) else { return .null }
            switch args[0] {
            case .string(let v): return .number(Double(v.count))
            case .array(let v): return .number(Double(v.count))
            case .object(let v): return .number(Double(v.count))
            case .null: return .number(0)
            default: return ctx.typeError(&errors, "len は文字列・配列・オブジェクトにのみ適用できます")
            }

        case "upper":
            guard ctx.arity(1, &errors), let s = ctx.str(0) else { return ctx.typeError(&errors) }
            return .string(s.uppercased())
        case "lower":
            guard ctx.arity(1, &errors), let s = ctx.str(0) else { return ctx.typeError(&errors) }
            return .string(s.lowercased())
        case "trim":
            guard ctx.arity(1, &errors), let s = ctx.str(0) else { return ctx.typeError(&errors) }
            return .string(s.trimmingCharacters(in: .whitespacesAndNewlines))

        case "contains":
            guard ctx.arity(2, &errors) else { return .null }
            switch args[0] {
            case .string(let target):
                guard let needle = ctx.str(1) else { return ctx.typeError(&errors) }
                return .bool(needle.isEmpty ? true : target.contains(needle))
            case .array(let items):
                return .bool(items.contains(args[1]))
            default:
                return ctx.typeError(&errors, "contains は文字列または配列にのみ適用できます")
            }

        case "startsWith":
            guard ctx.arity(2, &errors), let s = ctx.str(0), let p = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            return .bool(s.hasPrefix(p))

        case "endsWith":
            guard ctx.arity(2, &errors), let s = ctx.str(0), let p = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            return .bool(s.hasSuffix(p))

        case "join":
            guard ctx.arity(2, &errors), let arr = ctx.arr(0), let sep = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            return .string(arr.map { $0.stringify() }.joined(separator: sep))

        case "split":
            guard ctx.arity(2, &errors), let s = ctx.str(0), let sep = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            let parts = sep.isEmpty ? [s] : s.components(separatedBy: sep)
            return .array(parts.map { .string($0) })

        case "replace":
            // 正規表現ではなく単純な部分文字列置換。式言語に正規表現は入れない。
            guard ctx.arity(3, &errors), let s = ctx.str(0), let from = ctx.str(1), let to = ctx.str(2) else {
                return ctx.typeError(&errors)
            }
            return .string(from.isEmpty ? s : s.replacingOccurrences(of: from, with: to))

        case "slice":
            guard ctx.arityRange(2, 3, &errors) else { return .null }
            return slice(ctx, &errors)

        // MARK: 数値
        case "min":
            guard ctx.arity(2, &errors), let a = ctx.num(0), let b = ctx.num(1) else {
                return ctx.typeError(&errors)
            }
            return .number(Swift.min(a, b))
        case "max":
            guard ctx.arity(2, &errors), let a = ctx.num(0), let b = ctx.num(1) else {
                return ctx.typeError(&errors)
            }
            return .number(Swift.max(a, b))
        case "abs":
            guard ctx.arity(1, &errors), let n = ctx.num(0) else { return ctx.typeError(&errors) }
            return .number(Swift.abs(n))
        case "floor":
            guard ctx.arity(1, &errors), let n = ctx.num(0) else { return ctx.typeError(&errors) }
            return .number(n.rounded(.down))
        case "ceil":
            guard ctx.arity(1, &errors), let n = ctx.num(0) else { return ctx.typeError(&errors) }
            return .number(n.rounded(.up))
        case "round":
            guard ctx.arityRange(1, 2, &errors) else { return .null }
            return round(ctx, &errors)
        case "sum":
            guard ctx.arity(1, &errors), let arr = ctx.arr(0) else { return ctx.typeError(&errors) }
            var total = 0.0
            for item in arr {
                guard case .number(let n) = item else {
                    return ctx.typeError(&errors, "sum は数値の配列にのみ適用できます")
                }
                total += n
            }
            return .number(total)
        case "toNumber":
            guard ctx.arity(1, &errors) else { return .null }
            return toNumber(args[0])
        case "toString":
            guard ctx.arity(1, &errors) else { return .null }
            return .string(args[0].stringify())

        // MARK: 論理・コレクション
        case "if":
            guard ctx.arity(3, &errors) else { return .null }
            return args[0].isTruthy ? args[1] : args[2]
        case "coalesce":
            guard ctx.atLeast(1, &errors) else { return .null }
            return args.first { !$0.isNull } ?? .null
        case "default":
            guard ctx.arity(2, &errors) else { return .null }
            return args[0].isBlank ? args[1] : args[0]
        case "has":
            guard ctx.arity(2, &errors), let obj = args[0].asObject, let key = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            return .bool(obj.index(forKey: key) != nil)
        case "get":
            guard ctx.arityRange(2, 3, &errors), let p = ctx.str(1) else {
                return ctx.typeError(&errors)
            }
            let found = args[0].path(p)
            return (found.isNull && args.count == 3) ? args[2] : found
        case "first":
            guard ctx.arity(1, &errors) else { return .null }
            return ctx.arr(0)?.first ?? .null
        case "last":
            guard ctx.arity(1, &errors) else { return .null }
            return ctx.arr(0)?.last ?? .null
        case "indexOf":
            guard ctx.arity(2, &errors), let arr = ctx.arr(0) else { return ctx.typeError(&errors) }
            return .number(Double(arr.firstIndex(of: args[1]) ?? -1))

        // MARK: 環境
        case "isPlatform":
            guard ctx.arity(1, &errors) else { return .null }
            return .bool(scope.env.path("platform").stringify() == args[0].stringify())
        case "versionAtLeast":
            guard ctx.arity(1, &errors) else { return .null }
            return .bool(
                BuiltinFunctions.compareVersions(
                    scope.env.path("appVersion").stringify(),
                    args[0].stringify()
                ) >= 0
            )

        // MARK: 書式 (ロケール依存。ネイティブのフォーマッタに委譲)
        case "formatNumber":
            guard ctx.arityRange(1, 2, &errors) else { return .null }
            return formatNumber(ctx, &errors)
        case "formatCurrency":
            guard ctx.arity(2, &errors) else { return .null }
            return formatCurrency(ctx, &errors)
        case "formatPercent":
            guard ctx.arityRange(1, 2, &errors) else { return .null }
            return formatPercent(ctx, &errors)
        case "formatDate":
            guard ctx.arity(2, &errors) else { return .null }
            return formatDate(ctx, &errors)
        case "plural":
            guard ctx.arity(2, &errors) else { return .null }
            return plural(ctx, &errors)

        default:
            // 新しいスキーマバージョンで追加された関数を古いクライアントが
            // 受け取った場合もここに来る。
            errors.append(ExprError(.unknownFunction, "未知の関数 '\(name)'"))
            return .null
        }
    }

    // MARK: - 個別実装

    private func slice(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let start = ctx.num(1).map({ Int($0) }) else { return ctx.typeError(&errors) }
        var end: Int?
        if ctx.args.count == 3 {
            guard let e = ctx.num(2).map({ Int($0) }) else { return ctx.typeError(&errors) }
            end = e
        }
        switch ctx.args[0] {
        case .string(let text):
            let chars = Array(text)
            let from = Swift.min(Swift.max(start, 0), chars.count)
            let to = Swift.min(Swift.max(end ?? chars.count, from), chars.count)
            return .string(String(chars[from..<to]))
        case .array(let items):
            let from = Swift.min(Swift.max(start, 0), items.count)
            let to = Swift.min(Swift.max(end ?? items.count, from), items.count)
            return .array(Array(items[from..<to]))
        default:
            return ctx.typeError(&errors, "slice は文字列または配列にのみ適用できます")
        }
    }

    private func round(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let n = ctx.num(0) else { return ctx.typeError(&errors) }
        var digits = 0
        if ctx.args.count == 2 {
            guard let d = ctx.num(1).map({ Int($0) }) else { return ctx.typeError(&errors) }
            digits = d
        }
        if digits == 0 { return .number(BuiltinFunctions.roundHalfUp(n)) }
        let factor = pow(10.0, Double(digits))
        return .number(BuiltinFunctions.roundHalfUp(n * factor) / factor)
    }

    /// half-up (+∞方向)。Kotlin/Swift/JS の Math.round と同じ挙動に揃えている。
    static func roundHalfUp(_ v: Double) -> Double { (v + 0.5).rounded(.down) }

    private func toNumber(_ value: SpValue) -> SpValue {
        switch value {
        case .number: return value
        // 変換失敗は null。エラーではなく値として扱う (docs/spec/expression.md §4)。
        case .string(let s):
            guard let d = Double(s.trimmingCharacters(in: .whitespaces)) else { return .null }
            return .number(d)
        case .bool(let b): return .number(b ? 1 : 0)
        default: return .null
        }
    }

    private func formatNumber(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let n = ctx.num(0) else { return ctx.typeError(&errors) }
        let opts = ctx.args.count == 2 ? ctx.args[1].asObject : nil
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = ctx.locale
        if let grouping = opts?["grouping"] { formatter.usesGroupingSeparator = grouping.isTruthy }
        if let minDigits = opts?["minFractionDigits"]?.asInt { formatter.minimumFractionDigits = minDigits }
        formatter.maximumFractionDigits = opts?["maxFractionDigits"]?.asInt ?? 3
        guard let text = formatter.string(from: NSNumber(value: n)) else {
            return ctx.typeError(&errors, "数値を整形できません")
        }
        return .string(text)
    }

    private func formatCurrency(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let n = ctx.num(0), let code = ctx.str(1) else { return ctx.typeError(&errors) }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = ctx.locale
        formatter.currencyCode = code
        guard let text = formatter.string(from: NSNumber(value: n)) else {
            return ctx.typeError(&errors, "未知の通貨コード '\(code)'")
        }
        return .string(text)
    }

    private func formatPercent(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let n = ctx.num(0) else { return ctx.typeError(&errors) }
        var digits = 0
        if ctx.args.count == 2 {
            guard let d = ctx.num(1).map({ Int($0) }) else { return ctx.typeError(&errors) }
            digits = d
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.locale = ctx.locale
        formatter.minimumFractionDigits = digits
        formatter.maximumFractionDigits = digits
        guard let text = formatter.string(from: NSNumber(value: n)) else {
            return ctx.typeError(&errors, "数値を整形できません")
        }
        return .string(text)
    }

    private func formatDate(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let iso = ctx.str(0), let style = ctx.str(1) else { return ctx.typeError(&errors) }
        guard let date = BuiltinFunctions.parseISO8601(iso) else {
            return ctx.typeError(&errors, "ISO 8601 として解釈できません: \(iso)")
        }
        if style == "relative" {
            let formatter = RelativeDateTimeFormatter()
            formatter.locale = ctx.locale
            return .string(formatter.localizedString(for: date, relativeTo: Date()))
        }
        let dateStyle: DateFormatter.Style
        switch style {
        case "short": dateStyle = .short
        case "medium": dateStyle = .medium
        case "long": dateStyle = .long
        default: return ctx.typeError(&errors, "未知の日付スタイル '\(style)'")
        }
        let formatter = DateFormatter()
        formatter.locale = ctx.locale
        formatter.timeZone = ctx.timeZone
        formatter.dateStyle = dateStyle
        formatter.timeStyle = .none
        return .string(formatter.string(from: date))
    }

    static func parseISO8601(_ text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: text) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: text)
    }

    private func plural(_ ctx: Ctx, _ errors: inout [ExprError]) -> SpValue {
        guard let n = ctx.num(0) else { return ctx.typeError(&errors) }
        guard let forms = ctx.args[1].asObject else {
            return ctx.typeError(&errors, "plural の第2引数は形式のオブジェクトです")
        }
        let category = BuiltinFunctions.pluralCategory(n, language: ctx.locale.language.languageCode?.identifier ?? "en")
        guard let form = forms[category] ?? forms["other"] else { return .null }
        // ICU の '#' と同じく、選ばれた形式の中の '#' を数値に置換する。
        return .string(form.stringify().replacingOccurrences(of: "#", with: SpValue.formatNumberPlain(n)))
    }

    /// v0.1 は最小限の CLDR 近似。複数形のない言語では常に other。
    static func pluralCategory(_ n: Double, language: String) -> String {
        switch language {
        case "ja", "zh", "ko", "th", "vi", "id", "ms": return "other"
        default: return n == 1 ? "one" : "other"
        }
    }

    static func compareVersions(_ a: String, _ b: String) -> Int {
        func parts(_ s: String) -> [Int] {
            s.split(separator: ".").map { Int(String($0).prefix { $0.isNumber }) ?? 0 }
        }
        let left = parts(a), right = parts(b)
        for i in 0..<Swift.max(left.count, right.count) {
            let l = i < left.count ? left[i] : 0
            let r = i < right.count ? right[i] : 0
            if l != r { return l < r ? -1 : 1 }
        }
        return 0
    }

    // MARK: - 引数ヘルパ

    private struct Ctx {
        let name: String
        let args: [SpValue]
        let scope: EvalScope

        var locale: Locale {
            guard let tag = scope.env.path("locale").asString, !tag.isEmpty else {
                return Locale(identifier: "en_US")
            }
            return Locale(identifier: tag.replacingOccurrences(of: "-", with: "_"))
        }

        var timeZone: TimeZone {
            guard let id = scope.env.path("timeZone").asString, let zone = TimeZone(identifier: id) else {
                return TimeZone(identifier: "UTC")!
            }
            return zone
        }

        func str(_ i: Int) -> String? { i < args.count ? args[i].asString : nil }
        func num(_ i: Int) -> Double? { i < args.count ? args[i].asDouble : nil }
        func arr(_ i: Int) -> [SpValue]? { i < args.count ? args[i].asArray : nil }

        @discardableResult
        func typeError(_ errors: inout [ExprError], _ message: String? = nil) -> SpValue {
            errors.append(ExprError(.type, message ?? "\(name) の引数の型が正しくありません"))
            return .null
        }

        func arity(_ expected: Int, _ errors: inout [ExprError]) -> Bool {
            guard args.count == expected else {
                errors.append(ExprError(
                    .type,
                    "\(name) は引数を \(expected) 個取ります (\(args.count) 個が渡されました)"
                ))
                return false
            }
            return true
        }

        func arityRange(_ min: Int, _ max: Int, _ errors: inout [ExprError]) -> Bool {
            guard args.count >= min, args.count <= max else {
                errors.append(ExprError(
                    .type,
                    "\(name) は引数を \(min)〜\(max) 個取ります (\(args.count) 個が渡されました)"
                ))
                return false
            }
            return true
        }

        func atLeast(_ min: Int, _ errors: inout [ExprError]) -> Bool {
            guard args.count >= min else {
                errors.append(ExprError(.type, "\(name) は引数を \(min) 個以上取ります"))
                return false
            }
            return true
        }
    }
}
