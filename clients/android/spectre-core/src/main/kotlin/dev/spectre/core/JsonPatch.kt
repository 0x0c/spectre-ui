package dev.spectre.core

/**
 * RFC 6902 (JSON Patch) の適用。`applyPatch` アクションが動かす
 * (docs/spec/actions.md `applyPatch`) — `${'$'}{node.id}` のような式ではなく、
 * `/root/children/2/props/text` のような JSON Pointer (RFC 6901) でノードを指す。
 *
 * 対象はドキュメントのノード木 (`/root/...`) や `/overlays/...` を想定している。
 * `data`/`state` の更新は `request` の応答が持つ専用のフィールドが担うため、
 * ここでは特別扱いしない — 単純に与えられたポインタへ適用するだけ。
 */
object JsonPatch {

    class PatchException(message: String) : Exception(message)

    fun apply(document: SpValue, operations: List<SpValue>): SpValue {
        var current = document
        for (raw in operations) {
            val op = raw as? SpValue.Obj ?: throw PatchException("patch の要素はオブジェクトである必要があります")
            current = applyOne(current, op)
        }
        return current
    }

    private fun applyOne(root: SpValue, op: SpValue.Obj): SpValue {
        val kind = op.entries["op"]?.asStringOrNull ?: throw PatchException("op がありません")
        val path = op.entries["path"]?.asStringOrNull ?: throw PatchException("path がありません")
        val pointer = parsePointer(path)
        return when (kind) {
            "add" -> setAt(root, pointer, op.value("value"), insert = true)
            "replace" -> setAt(root, pointer, op.value("value"), insert = false)
            "remove" -> removeAt(root, pointer)
            "move" -> {
                val from = parsePointer(op.pathOf("from"))
                val value = getAt(root, from)
                setAt(removeAt(root, from), pointer, value, insert = true)
            }
            "copy" -> {
                val from = parsePointer(op.pathOf("from"))
                setAt(root, pointer, getAt(root, from), insert = true)
            }
            "test" -> {
                if (getAt(root, pointer) != op.value("value")) {
                    throw PatchException("test に失敗しました: $path")
                }
                root
            }
            else -> throw PatchException("未知の op です: $kind")
        }
    }

    private fun SpValue.Obj.value(key: String): SpValue = entries[key] ?: SpValue.Null
    private fun SpValue.Obj.pathOf(key: String): String =
        entries[key]?.asStringOrNull ?: throw PatchException("$key がありません")

    /** `/a/b~1c/2` -> `["a", "b/c", "2"]`。`~1` -> `/`、`~0` -> `~` (RFC 6901 §4)。 */
    private fun parsePointer(pointer: String): List<String> {
        if (pointer.isEmpty()) return emptyList()
        if (!pointer.startsWith("/")) throw PatchException("JSON Pointer は / から始まる必要があります: $pointer")
        return pointer.substring(1).split("/").map { it.replace("~1", "/").replace("~0", "~") }
    }

    private fun getAt(value: SpValue, segments: List<String>): SpValue {
        if (segments.isEmpty()) return value
        val head = segments[0]
        return when (value) {
            is SpValue.Obj -> getAt(
                value.entries[head] ?: throw PatchException("パスが見つかりません: $head"),
                segments.drop(1),
            )
            is SpValue.Arr -> getAt(
                value.items.getOrNull(indexOf(head, value.items.size))
                    ?: throw PatchException("配列インデックスが範囲外です: $head"),
                segments.drop(1),
            )
            else -> throw PatchException("これ以上パスを辿れません: $head")
        }
    }

    private fun setAt(value: SpValue, segments: List<String>, newValue: SpValue, insert: Boolean): SpValue {
        if (segments.isEmpty()) return newValue
        val head = segments[0]
        val rest = segments.drop(1)
        return when (value) {
            is SpValue.Obj -> if (rest.isEmpty()) {
                SpValue.Obj(value.entries + (head to newValue))
            } else {
                val child = value.entries[head] ?: throw PatchException("パスが見つかりません: $head")
                SpValue.Obj(value.entries + (head to setAt(child, rest, newValue, insert)))
            }

            is SpValue.Arr -> {
                val items = value.items.toMutableList()
                if (rest.isEmpty()) {
                    if (insert) {
                        val index = if (head == "-") items.size else indexOf(head, items.size + 1)
                        if (index !in 0..items.size) throw PatchException("配列インデックスが範囲外です: $head")
                        items.add(index, newValue)
                    } else {
                        val index = indexOf(head, items.size)
                        if (index !in items.indices) throw PatchException("配列インデックスが範囲外です: $head")
                        items[index] = newValue
                    }
                    SpValue.Arr(items)
                } else {
                    val index = indexOf(head, items.size)
                    if (index !in items.indices) throw PatchException("配列インデックスが範囲外です: $head")
                    items[index] = setAt(items[index], rest, newValue, insert)
                    SpValue.Arr(items)
                }
            }

            else -> throw PatchException("これ以上パスを辿れません: $head")
        }
    }

    private fun removeAt(value: SpValue, segments: List<String>): SpValue {
        if (segments.isEmpty()) throw PatchException("ドキュメント全体は削除できません")
        val head = segments[0]
        val rest = segments.drop(1)
        return when (value) {
            is SpValue.Obj -> if (rest.isEmpty()) {
                if (head !in value.entries) throw PatchException("パスが見つかりません: $head")
                SpValue.Obj(value.entries - head)
            } else {
                val child = value.entries[head] ?: throw PatchException("パスが見つかりません: $head")
                SpValue.Obj(value.entries + (head to removeAt(child, rest)))
            }

            is SpValue.Arr -> {
                val items = value.items.toMutableList()
                val index = indexOf(head, items.size)
                if (index !in items.indices) throw PatchException("配列インデックスが範囲外です: $head")
                if (rest.isEmpty()) {
                    items.removeAt(index)
                } else {
                    items[index] = removeAt(items[index], rest)
                }
                SpValue.Arr(items)
            }

            else -> throw PatchException("これ以上パスを辿れません: $head")
        }
    }

    private fun indexOf(segment: String, size: Int): Int =
        if (segment == "-") size else segment.toIntOrNull() ?: throw PatchException("不正な配列インデックス: $segment")
}
