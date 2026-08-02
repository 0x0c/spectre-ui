package dev.spectre.core

import org.junit.jupiter.api.DisplayName
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** RFC 6902 (JSON Patch) の適用を検証する。`applyPatch` アクションが使う (docs/spec/actions.md)。 */
class JsonPatchTest {

    private fun doc(json: String): SpValue = Conformance.parseObject(json)

    @Test
    @DisplayName("replace はパス先の値を差し替える")
    fun replaceReplacesValue() {
        val root = doc("""{"root":{"props":{"text":"old"}}}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"replace","path":"/root/props/text","value":"new"}""")),
        )
        assertEquals(SpValue.Str("new"), result.path("root.props.text"))
    }

    @Test
    @DisplayName("add はオブジェクトに新しいキーを足す")
    fun addInsertsObjectKey() {
        val root = doc("""{"root":{"props":{}}}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"add","path":"/root/props/text","value":"hello"}""")),
        )
        assertEquals(SpValue.Str("hello"), result.path("root.props.text"))
    }

    @Test
    @DisplayName("add は配列の指定位置に挿入する")
    fun addInsertsIntoArrayAtIndex() {
        val root = doc("""{"items":["a","c"]}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"add","path":"/items/1","value":"b"}""")),
        )
        assertEquals(
            listOf("a", "b", "c"),
            (result.path("items") as SpValue.Arr).items.map { it.asStringOrNull },
        )
    }

    @Test
    @DisplayName("add は - で配列の末尾に追加する")
    fun addAppendsWithDashIndex() {
        val root = doc("""{"items":["a"]}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"add","path":"/items/-","value":"b"}""")),
        )
        assertEquals(
            listOf("a", "b"),
            (result.path("items") as SpValue.Arr).items.map { it.asStringOrNull },
        )
    }

    @Test
    @DisplayName("remove は配列要素を取り除き詰める")
    fun removeDeletesArrayElement() {
        val root = doc("""{"items":["a","b","c"]}""")
        val result = JsonPatch.apply(root, listOf(Conformance.parseObject("""{"op":"remove","path":"/items/1"}""")))
        assertEquals(
            listOf("a", "c"),
            (result.path("items") as SpValue.Arr).items.map { it.asStringOrNull },
        )
    }

    @Test
    @DisplayName("remove はオブジェクトのキーを取り除く")
    fun removeDeletesObjectKey() {
        val root = doc("""{"props":{"a":1,"b":2}}""")
        val result = JsonPatch.apply(root, listOf(Conformance.parseObject("""{"op":"remove","path":"/props/a"}""")))
        assertEquals(setOf("b"), (result.path("props") as SpValue.Obj).entries.keys)
    }

    @Test
    @DisplayName("move は元の位置から取り除いて新しい位置へ移す")
    fun moveRelocatesValue() {
        val root = doc("""{"a":{"x":1},"b":{}}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"move","from":"/a/x","path":"/b/x"}""")),
        )
        assertEquals(SpValue.Null, (result.path("a") as SpValue.Obj).entries["x"] ?: SpValue.Null)
        assertEquals(SpValue.Num(1.0), result.path("b.x"))
    }

    @Test
    @DisplayName("copy は元の値を残したまま複製する")
    fun copyDuplicatesValue() {
        val root = doc("""{"a":{"x":1},"b":{}}""")
        val result = JsonPatch.apply(
            root,
            listOf(Conformance.parseObject("""{"op":"copy","from":"/a/x","path":"/b/x"}""")),
        )
        assertEquals(SpValue.Num(1.0), result.path("a.x"))
        assertEquals(SpValue.Num(1.0), result.path("b.x"))
    }

    @Test
    @DisplayName("test はパスの値が一致しないとき例外を投げる")
    fun testOpThrowsOnMismatch() {
        val root = doc("""{"a":1}""")
        assertFailsWith<JsonPatch.PatchException> {
            JsonPatch.apply(root, listOf(Conformance.parseObject("""{"op":"test","path":"/a","value":2}""")))
        }
    }

    @Test
    @DisplayName("存在しないパスは例外を投げる")
    fun missingPathThrows() {
        val root = doc("""{"a":1}""")
        assertFailsWith<JsonPatch.PatchException> {
            JsonPatch.apply(root, listOf(Conformance.parseObject("""{"op":"replace","path":"/missing/x","value":1}""")))
        }
    }

    @Test
    @DisplayName("複数の操作は順番に適用される")
    fun appliesOperationsInOrder() {
        val root = doc("""{"items":["a"]}""")
        val result = JsonPatch.apply(
            root,
            listOf(
                Conformance.parseObject("""{"op":"add","path":"/items/-","value":"b"}"""),
                Conformance.parseObject("""{"op":"replace","path":"/items/0","value":"A"}"""),
            ),
        )
        assertEquals(
            listOf("A", "b"),
            (result.path("items") as SpValue.Arr).items.map { it.asStringOrNull },
        )
    }

    @Test
    @DisplayName("patch 適用後のドキュメントも 1MB 上限の対象になる (applyPatch が抜け道にならない)")
    fun patchedDocumentStillEnforcesDocumentSizeLimit() {
        val original = """
            {"schemaVersion":"1.0","id":"s","root":{"type":"Text","props":{"text":"x"}}}
        """.trimIndent()
        val document = DocumentParser.parse(original)
        val huge = SpValue.Str("x".repeat(SpectreLimits.MAX_DOCUMENT_BYTES + 1))
        val patched = JsonPatch.apply(
            requireNotNull(document.raw),
            listOf(
                SpValue.Obj(
                    mapOf(
                        "op" to SpValue.Str("replace"),
                        "path" to SpValue.Str("/root/props/text"),
                        "value" to huge,
                    )
                )
            ),
        ) as SpValue.Obj

        assertFailsWith<DocumentParser.ParseException> { DocumentParser.parse(patched) }
    }
}
