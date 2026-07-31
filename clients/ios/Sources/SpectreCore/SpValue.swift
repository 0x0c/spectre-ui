import Foundation

/// ドキュメント・状態・式評価で扱う値の統一表現。
///
/// JSON の値域と 1:1 に対応するが、数値は常に `Double` として保持する。
/// これは Kotlin 実装 (`SpValue.Num(Double)`) と揃えるためで、整数/浮動小数の
/// 区別によるプラットフォーム差を持ち込まないための意図的な選択。
public indirect enum SpValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([SpValue])
    case object([String: SpValue])

    public static let emptyObject = SpValue.object([:])
}

// MARK: - 真偽判定 (docs/spec/expression.md §3)

public extension SpValue {
    var isTruthy: Bool {
        switch self {
        case .null: return false
        case .bool(let value): return value
        case .number(let value): return value != 0 && !value.isNaN
        case .string(let value): return !value.isEmpty
        case .array(let items): return !items.isEmpty
        case .object(let entries): return !entries.isEmpty
        }
    }

    /// `default()` が代替値に差し替える「空」の判定。
    var isBlank: Bool {
        switch self {
        case .null: return true
        case .string(let value): return value.isEmpty
        case .array(let items): return items.isEmpty
        case .object(let entries): return entries.isEmpty
        default: return false
        }
    }

    var isNull: Bool {
        if case .null = self { return true }
        return false
    }
}

// MARK: - 文字列化 (docs/spec/expression.md §1)

public extension SpValue {
    /// 文字列補間で使う表現。
    ///
    /// null が空文字になるのは UI 表示のため。`"在庫: ${data.stock}"` で
    /// stock が欠けているときに `"在庫: null"` と出るより空のほうが害が小さい。
    func stringify() -> String {
        switch self {
        case .null: return ""
        case .bool(let value): return value ? "true" : "false"
        case .number(let value): return SpValue.formatNumberPlain(value)
        case .string(let value): return value
        case .array(let items):
            return "[" + items.map { $0.jsonLikeString() }.joined(separator: ",") + "]"
        case .object(let entries):
            // Kotlin 側と出力を揃えるためキー順を固定する
            let body = entries.keys.sorted().map { key in
                "\(SpValue.quoteJSON(key)):\(entries[key]!.jsonLikeString())"
            }
            return "{" + body.joined(separator: ",") + "}"
        }
    }

    private func jsonLikeString() -> String {
        switch self {
        case .null: return "null"
        case .string(let value): return SpValue.quoteJSON(value)
        default: return stringify()
        }
    }

    static func quoteJSON(_ s: String) -> String {
        var out = "\""
        for ch in s {
            switch ch {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default: out.append(ch)
            }
        }
        return out + "\""
    }

    /// ロケール非依存の素の数値表記。整数値は小数部を落とす (1280.0 -> "1280")。
    static func formatNumberPlain(_ d: Double) -> String {
        if d.isNaN { return "NaN" }
        if d.isInfinite { return d > 0 ? "Infinity" : "-Infinity" }
        if d == 0 { return "0" }
        if isWholeNumber(d) { return String(Int64(d)) }
        var s = String(d)
        if s.hasSuffix(".0") { s.removeLast(2) }
        return s
    }

    static func isWholeNumber(_ d: Double) -> Bool {
        !d.isNaN && !d.isInfinite && d == d.rounded(.down) && abs(d) < 1e15
    }
}

// MARK: - アクセサ

public extension SpValue {
    var asString: String? { if case .string(let v) = self { return v }; return nil }
    var asDouble: Double? { if case .number(let v) = self { return v }; return nil }
    var asInt: Int? { if case .number(let v) = self { return Int(v) }; return nil }
    var asBool: Bool? { if case .bool(let v) = self { return v }; return nil }
    var asArray: [SpValue]? { if case .array(let v) = self { return v }; return nil }
    var asObject: [String: SpValue]? { if case .object(let v) = self { return v }; return nil }

    subscript(key: String) -> SpValue? {
        if case .object(let entries) = self { return entries[key] }
        return nil
    }

    /// ドット区切りのパスで値を辿る。存在しなければ `.null`。
    func path(_ path: String) -> SpValue {
        guard !path.isEmpty else { return self }
        var current = self
        for segment in path.split(separator: ".") {
            switch current {
            case .object(let entries):
                guard let next = entries[String(segment)] else { return .null }
                current = next
            case .array(let items):
                guard let index = Int(segment), index >= 0, index < items.count else { return .null }
                current = items[index]
            default:
                return .null
            }
        }
        return current
    }

    /// ドット区切りのパスに値を書き込んだコピーを返す。
    /// 途中のオブジェクトは存在しなければ作成される (`form.email` -> `{form:{email:...}}`)。
    func settingPath(_ path: String, to value: SpValue) -> SpValue {
        let segments = path.split(separator: ".").map(String.init)
        guard !segments.isEmpty else { return self }
        return SpValue.setRecursive(self, segments, 0, value)
    }

    private static func setRecursive(
        _ target: SpValue,
        _ segments: [String],
        _ index: Int,
        _ value: SpValue
    ) -> SpValue {
        var entries = target.asObject ?? [:]
        let key = segments[index]
        if index == segments.count - 1 {
            entries[key] = value
        } else {
            let child = entries[key] ?? SpValue.emptyObject
            entries[key] = setRecursive(child, segments, index + 1, value)
        }
        return .object(entries)
    }

    /// 浅いマージ。サーバ応答の `state` / `data` をローカルに反映するときに使う。
    func merging(_ other: SpValue) -> SpValue {
        guard let base = asObject, let patch = other.asObject else { return other }
        return .object(base.merging(patch) { _, new in new })
    }
}

// MARK: - JSON 相互変換

public extension SpValue {
    static func from(jsonData: Data) throws -> SpValue {
        let object = try JSONSerialization.jsonObject(with: jsonData, options: [.fragmentsAllowed])
        return from(jsonObject: object)
    }

    static func from(jsonString: String) throws -> SpValue {
        guard let data = jsonString.data(using: .utf8) else {
            throw SpectreError.parse("UTF-8 として解釈できません")
        }
        return try from(jsonData: data)
    }

    static func from(jsonObject: Any) -> SpValue {
        switch jsonObject {
        case is NSNull:
            return .null
        case let number as NSNumber:
            // JSONSerialization は Bool も NSNumber で返すため型 ID で見分ける
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let string as String:
            return .string(string)
        case let array as [Any]:
            return .array(array.map { from(jsonObject: $0) })
        case let dictionary as [String: Any]:
            var entries: [String: SpValue] = [:]
            entries.reserveCapacity(dictionary.count)
            for (key, value) in dictionary { entries[key] = from(jsonObject: value) }
            return .object(entries)
        default:
            return .null
        }
    }

    func toJSONObject() -> Any {
        switch self {
        case .null: return NSNull()
        case .bool(let value): return value
        case .number(let value):
            return SpValue.isWholeNumber(value) ? Int64(value) : value
        case .string(let value): return value
        case .array(let items): return items.map { $0.toJSONObject() }
        case .object(let entries): return entries.mapValues { $0.toJSONObject() }
        }
    }
}

public enum SpectreError: Error, CustomStringConvertible {
    case parse(String)
    case limitExceeded(String)

    public var description: String {
        switch self {
        case .parse(let message): return "パースエラー: \(message)"
        case .limitExceeded(let message): return "上限超過: \(message)"
        }
    }
}
