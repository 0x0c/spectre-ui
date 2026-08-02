"""Unit tests for `scripts/build_roadmap_index.py`.

The index page *is* the site's front page (`/`). If it crashes, the Pages deploy stops with it;
if it breaks quietly, a front page with one item missing goes live. `mkdocs build --strict`
never looks at this file, so there is no other layer checking it.

The HTML itself is not pinned — it is meant to change. Only what would hurt if it changed is:
that every item appears, that escaping works, and that the progress meter does not break.
"""

from __future__ import annotations

import html
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_roadmap_index as B  # noqa: E402
import roadmap_items as R  # noqa: E402


class EscTest(unittest.TestCase):
    def test_html_metacharacters_are_escaped(self):
        # Item titles and ledes are embedded into the HTML verbatim.
        self.assertEqual(B.esc("<script>"), "&lt;script&gt;")
        self.assertEqual(B.esc("a & b"), "a &amp; b")

    def test_plain_text_is_unchanged(self):
        self.assertEqual(B.esc("適合性コーパス"), "適合性コーパス")


class MeterTest(unittest.TestCase):
    def test_a_partial_meter(self):
        self.assertIn("50", B.meter(1, 2))

    def test_zero_of_zero_does_not_divide_by_zero(self):
        # An item whose units could not be counted must not bring the page down.
        self.assertIsInstance(B.meter(0, 0), str)

    def test_a_complete_meter(self):
        self.assertIn("100", B.meter(3, 3))


class BilingualTest(unittest.TestCase):
    def test_both_languages_appear(self):
        rendered = B.bilingual("日本語", "English")
        self.assertIn("日本語", rendered)
        self.assertIn("English", rendered)


class RenderTest(unittest.TestCase):
    def setUp(self):
        self.items = R.load_items()
        self.rendered = B.render(self.items)

    def test_the_output_is_a_complete_html_document(self):
        self.assertTrue(self.rendered.lstrip().lower().startswith("<!doctype html"))
        self.assertIn("</html>", self.rendered)

    def test_every_item_appears_with_both_titles(self):
        for item in self.items:
            with self.subTest(item=item.id):
                self.assertIn(item.id, self.rendered)
                self.assertIn(html.escape(item.title_en), self.rendered)
                self.assertIn(html.escape(item.title_ja), self.rendered)

    def test_every_item_links_to_both_language_files(self):
        for item in self.items:
            with self.subTest(item=item.id):
                self.assertIn(item.url_en, self.rendered)
                self.assertIn(item.url_ja, self.rendered)

    def test_every_status_in_use_is_labelled(self):
        for status in {item.status for item in self.items}:
            with self.subTest(status=status):
                self.assertIn(R.STATUS_JA[status], self.rendered)

    def test_the_language_is_declared(self):
        self.assertIn("<html", self.rendered)
        self.assertIn("lang=", self.rendered)


class MainTest(unittest.TestCase):
    def test_it_writes_index_html_into_the_given_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "site"
            original_argv = sys.argv
            sys.argv = ["build_roadmap_index.py", str(out)]
            try:
                B.main()
            finally:
                sys.argv = original_argv
            index = out / "index.html"
            self.assertTrue(index.is_file())
            self.assertIn("</html>", index.read_text(encoding="utf-8"))

    def test_it_creates_the_output_directory_if_it_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "a" / "b" / "site"
            original_argv = sys.argv
            sys.argv = ["build_roadmap_index.py", str(out)]
            try:
                B.main()
            finally:
                sys.argv = original_argv
            self.assertTrue((out / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
