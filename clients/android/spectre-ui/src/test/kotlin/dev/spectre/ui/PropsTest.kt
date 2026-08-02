package dev.spectre.ui

import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import dev.spectre.core.RenderNode
import dev.spectre.core.SpValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Unit tests for property extraction from a resolved node, and for the token-to-Compose maps.
 *
 * This is where the promise "a malformed document must not take the app down" is actually
 * written. Every function in Props.kt relies on falling back to a default rather than throwing
 * when a value is not the expected type, yet :spectre-ui had no tests at all and CI only ever
 * confirmed that `assembleDebug` compiled.
 *
 * The conformance corpus fixes the resolution results produced by the core (:spectre-core);
 * how the renderer then reads those results sits outside the corpus.
 */
class PropsTest {

    private fun node(vararg props: Pair<String, SpValue>): RenderNode =
        RenderNode(type = "Text", props = props.toMap())

    private fun str(value: String) = SpValue.Str(value)
    private fun num(value: Double) = SpValue.Num(value)
    private fun obj(vararg entries: Pair<String, SpValue>) = SpValue.Obj(entries.toMap())

    // -- string / stringOrNull ------------------------------------------------

    @Test
    fun `string returns the string as is`() {
        assertEquals("hello", node("text" to str("hello")).string("text"))
    }

    @Test
    fun `string stringifies numbers and booleans`() {
        // A lone expression such as `"${item}"` keeps its type and resolves as a number.
        assertEquals("1280", node("text" to num(1280.0)).string("text"))
        assertEquals("true", node("text" to SpValue.Bool(true)).string("text"))
    }

    @Test
    fun `string falls back for a missing property and for Null`() {
        assertEquals("", node().string("text"))
        assertEquals("fallback", node().string("text", default = "fallback"))
        assertEquals("fallback", node("text" to SpValue.Null).string("text", default = "fallback"))
    }

    @Test
    fun `stringOrNull returns null for a missing property and for Null`() {
        assertNull(node().stringOrNull("text"))
        assertNull(node("text" to SpValue.Null).stringOrNull("text"))
        assertEquals("x", node("text" to str("x")).stringOrNull("text"))
    }

    // -- bool -----------------------------------------------------------------

    @Test
    fun `bool follows the truthiness rule`() {
        assertEquals(true, node("on" to SpValue.Bool(true)).bool("on", default = false))
        assertEquals(false, node("on" to SpValue.Bool(false)).bool("on", default = true))
        assertEquals(true, node("on" to str("x")).bool("on", default = false))
        assertEquals(false, node("on" to str("")).bool("on", default = true))
        assertEquals(false, node("on" to num(0.0)).bool("on", default = true))
    }

    @Test
    fun `bool falls back for a missing property and for Null`() {
        assertEquals(true, node().bool("on", default = true))
        assertEquals(false, node().bool("on", default = false))
        assertEquals(true, node("on" to SpValue.Null).bool("on", default = true))
    }

    // -- int / float ----------------------------------------------------------

    @Test
    fun `int takes numbers and falls back for anything else`() {
        assertEquals(3, node("n" to num(3.0)).int("n", default = 0))
        assertEquals(0, node("n" to str("3")).int("n", default = 0), "strings are not coerced")
        assertEquals(7, node().int("n", default = 7))
    }

    @Test
    fun `intOrNull and floatOrNull return null when nothing can be taken`() {
        assertNull(node().intOrNull("n"))
        assertNull(node("n" to str("x")).intOrNull("n"))
        assertEquals(3, node("n" to num(3.0)).intOrNull("n"))
        assertNull(node().floatOrNull("n"))
        assertEquals(1.5f, node("n" to num(1.5)).floatOrNull("n"))
    }

    @Test
    fun `float keeps the fraction`() {
        assertEquals(1.5f, node("n" to num(1.5)).float("n", default = 0f))
        assertEquals(0.5f, node().float("n", default = 0.5f))
    }

    // -- token ----------------------------------------------------------------

    @Test
    fun `token accepts strings only`() {
        assertEquals("md", node("radius" to str("md")).token("radius", default = "none"))
        // A token is a name, not a number. Fall back when a number arrives.
        assertEquals("none", node("radius" to num(8.0)).token("radius", default = "none"))
        assertEquals("none", node().token("radius", default = "none"))
        assertNull(node().tokenOrNull("radius"))
    }

    // -- options --------------------------------------------------------------

    @Test
    fun `options reads value label and enabled`() {
        val node = node(
            "options" to SpValue.Arr(
                listOf(obj("value" to str("a"), "label" to str("A"), "enabled" to SpValue.Bool(false))),
            ),
        )
        assertEquals(listOf(SpectreOption("a", "A", enabled = false)), node.options("options"))
    }

    @Test
    fun `options defaults label to value and enabled to true`() {
        val node = node("options" to SpValue.Arr(listOf(obj("value" to str("a")))))
        assertEquals(listOf(SpectreOption("a", "a", enabled = true)), node.options("options"))
    }

    @Test
    fun `options drops entries without a value`() {
        // A broken entry costs only itself; the rest still render.
        val node = node(
            "options" to SpValue.Arr(
                listOf(obj("label" to str("A")), str("not even an entry"), obj("value" to str("b"))),
            ),
        )
        assertEquals(listOf(SpectreOption("b", "b")), node.options("options"))
    }

    @Test
    fun `options is empty when the value is not an array`() {
        assertEquals(emptyList(), node().options("options"))
        assertEquals(emptyList(), node("options" to str("not an array")).options("options"))
    }

    // -- tabItems -------------------------------------------------------------

    @Test
    fun `tabItems reads id label icon and badge`() {
        val node = node(
            "items" to SpValue.Arr(
                listOf(obj("id" to str("home"), "label" to str("Home"), "icon" to str("house"), "badge" to str("3"))),
            ),
        )
        assertEquals(listOf(SpectreTabItem("home", "Home", "house", "3")), node.tabItems())
    }

    @Test
    fun `tabItems defaults label to id and leaves icon and badge null`() {
        val node = node("items" to SpValue.Arr(listOf(obj("id" to str("home")))))
        assertEquals(listOf(SpectreTabItem("home", "home", null, null)), node.tabItems())
    }

    @Test
    fun `tabItems drops entries without an id`() {
        val node = node("items" to SpValue.Arr(listOf(obj("label" to str("A")), obj("id" to str("b")))))
        assertEquals(listOf(SpectreTabItem("b", "b", null, null)), node.tabItems())
    }

    // -- a11y -----------------------------------------------------------------

    @Test
    fun `a11yLabel returns the label`() {
        val node = RenderNode(type = "Text", a11y = mapOf("label" to str("image description")))
        assertEquals("image description", node.a11yLabel())
    }

    @Test
    fun `a11yLabel hides decorative nodes`() {
        // When hidden is true the node stays unread even if it carries a label.
        val node = RenderNode(
            type = "Image",
            a11y = mapOf("label" to str("decoration"), "hidden" to SpValue.Bool(true)),
        )
        assertNull(node.a11yLabel())
        assertTrue(node.a11yHidden())
    }

    @Test
    fun `a11yLabel is null when there is no label`() {
        assertNull(RenderNode(type = "Text").a11yLabel())
        assertNull(RenderNode(type = "Text", a11y = mapOf("label" to SpValue.Null)).a11yLabel())
    }

    @Test
    fun `a11yHidden defaults to false`() {
        assertEquals(false, RenderNode(type = "Text").a11yHidden())
        assertEquals(false, RenderNode(type = "Text", a11y = mapOf("hidden" to SpValue.Bool(false))).a11yHidden())
    }

    // -- token maps -----------------------------------------------------------
    // An unknown token always falls to the default. That is the path by which an older client
    // that does not know a newer token degrades to a near-enough look instead of crashing
    // (ADR-0006).

    @Test
    fun `textAlignOf`() {
        assertEquals(TextAlign.Center, textAlignOf("center"))
        assertEquals(TextAlign.End, textAlignOf("end"))
        assertEquals(TextAlign.Start, textAlignOf("start"))
        assertEquals(TextAlign.Start, textAlignOf("unknown-token"))
    }

    @Test
    fun `fontWeightOf`() {
        assertEquals(FontWeight.Medium, fontWeightOf("medium"))
        assertEquals(FontWeight.Bold, fontWeightOf("bold"))
        assertNull(fontWeightOf("regular"), "the default weight is left to the theme")
        assertNull(fontWeightOf("unknown-token"))
    }

    @Test
    fun `textDecorationOf`() {
        assertEquals(TextDecoration.Underline, textDecorationOf("underline"))
        assertEquals(TextDecoration.LineThrough, textDecorationOf("strikethrough"))
        assertNull(textDecorationOf("none"))
        assertNull(textDecorationOf("unknown-token"))
    }

    @Test
    fun `overflowOf`() {
        assertEquals(TextOverflow.Clip, overflowOf("none"))
        assertEquals(TextOverflow.Ellipsis, overflowOf("tail"))
        // Compose has no middle truncation, so tail truncation stands in for it.
        assertEquals(TextOverflow.Ellipsis, overflowOf("middle"))
        assertEquals(TextOverflow.Ellipsis, overflowOf("unknown-token"))
    }

    @Test
    fun `contentScaleOf`() {
        assertEquals(ContentScale.Fit, contentScaleOf("fit"))
        assertEquals(ContentScale.Crop, contentScaleOf("fill"))
        assertEquals(ContentScale.Crop, contentScaleOf("unknown-token"))
    }

    @Test
    fun `horizontalAlignmentOf`() {
        assertEquals(Alignment.CenterHorizontally, horizontalAlignmentOf("center"))
        assertEquals(Alignment.End, horizontalAlignmentOf("trailing"))
        assertEquals(Alignment.Start, horizontalAlignmentOf("leading"))
        assertEquals(Alignment.Start, horizontalAlignmentOf("unknown-token"))
    }

    @Test
    fun `verticalAlignmentOf`() {
        assertEquals(Alignment.Top, verticalAlignmentOf("top"))
        assertEquals(Alignment.Bottom, verticalAlignmentOf("bottom"))
        assertEquals(Alignment.CenterVertically, verticalAlignmentOf("center"))
        assertEquals(Alignment.CenterVertically, verticalAlignmentOf("unknown-token"))
    }

    @Test
    fun `boxAlignmentOf maps all nine directions`() {
        assertEquals(Alignment.TopStart, boxAlignmentOf("topLeading"))
        assertEquals(Alignment.TopCenter, boxAlignmentOf("top"))
        assertEquals(Alignment.TopEnd, boxAlignmentOf("topTrailing"))
        assertEquals(Alignment.CenterStart, boxAlignmentOf("leading"))
        assertEquals(Alignment.Center, boxAlignmentOf("center"))
        assertEquals(Alignment.CenterEnd, boxAlignmentOf("trailing"))
        assertEquals(Alignment.BottomStart, boxAlignmentOf("bottomLeading"))
        assertEquals(Alignment.BottomCenter, boxAlignmentOf("bottom"))
        assertEquals(Alignment.BottomEnd, boxAlignmentOf("bottomTrailing"))
        assertEquals(Alignment.Center, boxAlignmentOf("unknown-token"))
    }
}
