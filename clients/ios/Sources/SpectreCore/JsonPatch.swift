import Foundation

/// RFC 6902 (JSON Patch) の適用。`applyPatch` アクションが動かす
/// (docs/spec/actions.md `applyPatch`) — `/root/children/2/props/text` のような
/// JSON Pointer (RFC 6901) でノードを指す。
///
/// 対象はドキュメントのノード木 (`/root/...`) や `/overlays/...` を想定している。
/// `data`/`state` の更新は `request` の応答が持つ専用のフィールドが担うため、
/// ここでは特別扱いしない — 単純に与えられたポインタへ適用するだけ。
public enum JsonPatch {

    public struct PatchError: Error, CustomStringConvertible {
        public let message: String
        public init(_ message: String) { self.message = message }
        public var description: String { message }
    }

    public static func apply(_ document: SpValue, _ operations: [SpValue]) throws -> SpValue {
        var current = document
        for raw in operations {
            guard case .object = raw else { throw PatchError("patch の要素はオブジェクトである必要があります") }
            current = try applyOne(current, raw)
        }
        return current
    }

    private static func applyOne(_ root: SpValue, _ op: SpValue) throws -> SpValue {
        guard let kind = op["op"]?.asString else { throw PatchError("op がありません") }
        guard let path = op["path"]?.asString else { throw PatchError("path がありません") }
        let pointer = try parsePointer(path)
        switch kind {
        case "add":
            return try setAt(root, pointer, op["value"] ?? .null, insert: true)
        case "replace":
            return try setAt(root, pointer, op["value"] ?? .null, insert: false)
        case "remove":
            return try removeAt(root, pointer)
        case "move":
            let from = try parsePointer(try pathOf(op, "from"))
            let value = try getAt(root, from)
            return try setAt(try removeAt(root, from), pointer, value, insert: true)
        case "copy":
            let from = try parsePointer(try pathOf(op, "from"))
            return try setAt(root, pointer, try getAt(root, from), insert: true)
        case "test":
            let expected = op["value"] ?? .null
            if try getAt(root, pointer) != expected { throw PatchError("test に失敗しました: \(path)") }
            return root
        default:
            throw PatchError("未知の op です: \(kind)")
        }
    }

    private static func pathOf(_ op: SpValue, _ key: String) throws -> String {
        guard let value = op[key]?.asString else { throw PatchError("\(key) がありません") }
        return value
    }

    /// `/a/b~1c/2` -> `["a", "b/c", "2"]`。`~1` -> `/`、`~0` -> `~` (RFC 6901 §4)。
    private static func parsePointer(_ pointer: String) throws -> [String] {
        guard !pointer.isEmpty else { return [] }
        guard pointer.hasPrefix("/") else { throw PatchError("JSON Pointer は / から始まる必要があります: \(pointer)") }
        return pointer.dropFirst().components(separatedBy: "/")
            .map { $0.replacingOccurrences(of: "~1", with: "/").replacingOccurrences(of: "~0", with: "~") }
    }

    private static func getAt(_ value: SpValue, _ segments: [String]) throws -> SpValue {
        guard let head = segments.first else { return value }
        let rest = Array(segments.dropFirst())
        switch value {
        case .object(let entries):
            guard let child = entries[head] else { throw PatchError("パスが見つかりません: \(head)") }
            return try getAt(child, rest)
        case .array(let items):
            let index = try indexOf(head, items.count)
            guard index >= 0, index < items.count else { throw PatchError("配列インデックスが範囲外です: \(head)") }
            return try getAt(items[index], rest)
        default:
            throw PatchError("これ以上パスを辿れません: \(head)")
        }
    }

    private static func setAt(_ value: SpValue, _ segments: [String], _ newValue: SpValue, insert: Bool) throws -> SpValue {
        guard let head = segments.first else { return newValue }
        let rest = Array(segments.dropFirst())
        switch value {
        case .object(var entries):
            if rest.isEmpty {
                entries[head] = newValue
            } else {
                guard let child = entries[head] else { throw PatchError("パスが見つかりません: \(head)") }
                entries[head] = try setAt(child, rest, newValue, insert: insert)
            }
            return .object(entries)

        case .array(var items):
            if rest.isEmpty {
                if insert {
                    let index = head == "-" ? items.count : try indexOf(head, items.count + 1)
                    guard index >= 0, index <= items.count else { throw PatchError("配列インデックスが範囲外です: \(head)") }
                    items.insert(newValue, at: index)
                } else {
                    let index = try indexOf(head, items.count)
                    guard index >= 0, index < items.count else { throw PatchError("配列インデックスが範囲外です: \(head)") }
                    items[index] = newValue
                }
                return .array(items)
            } else {
                let index = try indexOf(head, items.count)
                guard index >= 0, index < items.count else { throw PatchError("配列インデックスが範囲外です: \(head)") }
                items[index] = try setAt(items[index], rest, newValue, insert: insert)
                return .array(items)
            }

        default:
            throw PatchError("これ以上パスを辿れません: \(head)")
        }
    }

    private static func removeAt(_ value: SpValue, _ segments: [String]) throws -> SpValue {
        guard let head = segments.first else { throw PatchError("ドキュメント全体は削除できません") }
        let rest = Array(segments.dropFirst())
        switch value {
        case .object(var entries):
            if rest.isEmpty {
                guard entries[head] != nil else { throw PatchError("パスが見つかりません: \(head)") }
                entries.removeValue(forKey: head)
            } else {
                guard let child = entries[head] else { throw PatchError("パスが見つかりません: \(head)") }
                entries[head] = try removeAt(child, rest)
            }
            return .object(entries)

        case .array(var items):
            let index = try indexOf(head, items.count)
            guard index >= 0, index < items.count else { throw PatchError("配列インデックスが範囲外です: \(head)") }
            if rest.isEmpty {
                items.remove(at: index)
            } else {
                items[index] = try removeAt(items[index], rest)
            }
            return .array(items)

        default:
            throw PatchError("これ以上パスを辿れません: \(head)")
        }
    }

    private static func indexOf(_ segment: String, _ size: Int) throws -> Int {
        if segment == "-" { return size }
        guard let value = Int(segment) else { throw PatchError("不正な配列インデックス: \(segment)") }
        return value
    }
}
