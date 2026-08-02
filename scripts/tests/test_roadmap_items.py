"""Unit tests for `scripts/roadmap_items.py`.

This module turns the formatting conventions in `roadmaps/README.md` into something a machine
reads. Misreading them surfaces not as an exception but as a **plausible, wrong index** — every
item showing as "Proposal" because the status could not be picked up, or progress reading 0/0
because the `Progress` checklist was not counted. The site builds fine; only its content is
wrong.

Synthetic items are built to the convention, then bent one point at a time, and both readings
are pinned.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import roadmap_items as R  # noqa: E402

EN_TEMPLATE = """**English** · [日本語](SU-0099-example-item-ja.md)

# SU-0099 — An example item

<!-- SU-METADATA -->
| Field | Value |
|---|---|
| Proposal | [SU-0099](SU-0099-example-item.md) |
| Author | [@0x0c](https://github.com/0x0c) |
| Status | **{status}** |
| Topic | Tooling |
<!-- /SU-METADATA -->

## Introduction

The English lede paragraph.

## Detailed design

1. **First unit.** Does a thing.
2. **Second unit.** Does another thing.

## Progress

{progress_en}
"""

JA_TEMPLATE = """[English](SU-0099-example-item.md) · **日本語**

# SU-0099 — 例の項目

<!-- SU-METADATA -->
| 項目 | 値 |
|---|---|
| 提案 | [SU-0099](SU-0099-example-item-ja.md) |
| 起草者 | [@0x0c](https://github.com/0x0c) |
| 状態 | **{status_ja}** |
| トピック | ツール |
<!-- /SU-METADATA -->

## はじめに

日本語のリード文です。

## 詳細設計

1. **1つ目。** 何かをします。
2. **2つ目。** 別の何かをします。

## 進捗

{progress_ja}
"""


def write_item(
    root: Path,
    *,
    status: str = "In progress",
    status_ja: str = "実装中",
    progress_en: str = "- [x] First unit\n- [ ] Second unit",
    progress_ja: str = "- [x] 1つ目\n- [ ] 2つ目",
    slug: str = "SU-0099-example-item",
) -> Path:
    directory = root / slug
    directory.mkdir(parents=True)
    (directory / f"{slug}.md").write_text(
        EN_TEMPLATE.format(status=status, progress_en=progress_en), encoding="utf-8"
    )
    (directory / f"{slug}-ja.md").write_text(
        JA_TEMPLATE.format(status_ja=status_ja, progress_ja=progress_ja), encoding="utf-8"
    )
    return directory


class PlainTest(unittest.TestCase):
    def test_links_are_reduced_to_their_text(self):
        self.assertEqual(R._plain("see [SU-0001](a/b.md) now"), "see SU-0001 now")

    def test_bold_and_code_markers_are_dropped(self):
        self.assertEqual(R._plain("**In progress**"), "In progress")
        self.assertEqual(R._plain("run `mkdocs build`"), "run mkdocs build")

    def test_whitespace_is_collapsed(self):
        self.assertEqual(R._plain("a\n  b\t c"), "a b c")

    def test_empty_input(self):
        self.assertEqual(R._plain(""), "")


class ItemTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def test_reads_both_languages(self):
        item = R.Item(write_item(self.root))
        self.assertEqual(item.id, "SU-0099")
        self.assertEqual(item.number, 99)
        self.assertEqual(item.title_en, "An example item")
        self.assertEqual(item.title_ja, "例の項目")

    def test_the_id_is_dropped_from_the_title(self):
        # The H1 reads "SU-NNNN — Title". The index shows the ID separately, so drop it here.
        item = R.Item(write_item(self.root))
        self.assertNotIn("SU-0099", item.title_en)
        self.assertNotIn("SU-0099", item.title_ja)

    def test_metadata_fields_are_read_per_language(self):
        item = R.Item(write_item(self.root))
        self.assertEqual(item.status, "In progress")
        self.assertEqual(item.topic_en, "Tooling")
        self.assertEqual(item.topic_ja, "ツール")
        self.assertEqual(item.author, "@0x0c")

    def test_the_lede_is_the_first_paragraph_of_the_first_section(self):
        item = R.Item(write_item(self.root))
        self.assertEqual(item.lede_en, "The English lede paragraph.")
        self.assertEqual(item.lede_ja, "日本語のリード文です。")

    def test_progress_is_counted_from_the_checklist(self):
        item = R.Item(write_item(self.root))
        self.assertEqual((item.done, item.units), (1, 2))
        self.assertFalse(item.units_estimated)

    def test_a_fully_checked_item(self):
        item = R.Item(
            write_item(self.root, progress_ja="- [x] 1つ目\n- [x] 2つ目", progress_en="- [x] a\n- [x] b")
        )
        self.assertEqual((item.done, item.units), (2, 2))

    def test_uppercase_x_counts_as_done(self):
        item = R.Item(write_item(self.root, progress_ja="- [X] 1つ目\n- [ ] 2つ目"))
        self.assertEqual(item.done, 1)

    def test_a_not_started_placeholder_falls_back_to_the_design_units(self):
        # A single "not started" box says nothing about the size of the work, so the numbered
        # entries under Detailed design stand in as an estimate.
        item = R.Item(write_item(self.root, progress_ja="- [ ] 未着手", progress_en="- [ ] not started"))
        self.assertEqual((item.done, item.units), (0, 2))
        self.assertTrue(item.units_estimated)

    def test_the_status_can_be_recovered_from_the_japanese_side(self):
        # Even when the English Status cannot be read, the Japanese spelling still yields it.
        item = R.Item(write_item(self.root, status="", status_ja="実装済み"))
        self.assertEqual(item.status, "Implemented")

    def test_deferred_status_in_both_bracket_styles(self):
        for status_ja in ("提案（保留）", "提案 (保留)"):
            with self.subTest(status_ja=status_ja):
                with tempfile.TemporaryDirectory() as tmp:
                    item = R.Item(write_item(Path(tmp), status="", status_ja=status_ja))
                    self.assertEqual(item.status, "Proposal (deferred)")

    def test_an_unknown_status_is_an_error(self):
        with self.assertRaises(ValueError):
            R.Item(write_item(self.root, status="Shipped", status_ja="出荷済み"))

    def test_a_missing_counterpart_file_is_an_error(self):
        directory = write_item(self.root)
        (directory / "SU-0099-example-item-ja.md").unlink()
        with self.assertRaises(ValueError) as caught:
            R.Item(directory)
        self.assertIn("SU-0099-example-item-ja.md", str(caught.exception))

    def test_a_missing_metadata_block_is_an_error(self):
        directory = write_item(self.root)
        path = directory / "SU-0099-example-item.md"
        text = path.read_text(encoding="utf-8")
        path.write_text(text.replace("<!-- SU-METADATA -->", ""), encoding="utf-8")
        with self.assertRaises(ValueError) as caught:
            R.Item(directory)
        self.assertIn("SU-METADATA", str(caught.exception))

    def test_a_missing_h1_is_an_error(self):
        directory = write_item(self.root)
        path = directory / "SU-0099-example-item.md"
        text = path.read_text(encoding="utf-8")
        path.write_text(text.replace("# SU-0099 — An example item", ""), encoding="utf-8")
        with self.assertRaises(ValueError) as caught:
            R.Item(directory)
        self.assertIn("H1", str(caught.exception))

    def test_urls_point_at_both_language_files(self):
        item = R.Item(write_item(self.root))
        self.assertTrue(item.url_en.endswith("/roadmaps/SU-0099-example-item/SU-0099-example-item.md"))
        self.assertTrue(item.url_ja.endswith("/roadmaps/SU-0099-example-item/SU-0099-example-item-ja.md"))


class StatusTableTest(unittest.TestCase):
    """The status tables decide the index's ordering, marks and wording. A gap is a silent
    display defect."""

    def test_every_status_has_a_japanese_label_and_a_mark(self):
        for status in R.STATUS_ORDER:
            with self.subTest(status=status):
                self.assertIn(status, R.STATUS_JA)
                self.assertIn(status, R.STATUS_MARK)

    def test_the_japanese_reverse_table_maps_into_the_known_statuses(self):
        for status in R.STATUS_FROM_JA.values():
            with self.subTest(status=status):
                self.assertIn(status, R.STATUS_ORDER)

    def test_every_status_can_be_recovered_from_some_japanese_spelling(self):
        self.assertEqual(set(R.STATUS_FROM_JA.values()), set(R.STATUS_ORDER))


class RealRoadmapTest(unittest.TestCase):
    """The actual `roadmaps/` directory satisfies the convention."""

    def test_load_items_reads_the_repository(self):
        items = R.load_items()
        self.assertGreater(len(items), 0)

    def test_every_item_has_a_known_status_and_both_titles(self):
        for item in R.load_items():
            with self.subTest(item=item.id):
                self.assertIn(item.status, R.STATUS_ORDER)
                self.assertTrue(item.title_en)
                self.assertTrue(item.title_ja)

    def test_ids_are_unique_and_well_formed(self):
        items = R.load_items()
        ids = [item.id for item in items]
        self.assertEqual(len(set(ids)), len(ids))
        for item in items:
            with self.subTest(item=item.id):
                self.assertRegex(item.id, r"^SU-\d{4}$")

    def test_progress_never_exceeds_the_number_of_units(self):
        for item in R.load_items():
            with self.subTest(item=item.id):
                self.assertLessEqual(item.done, item.units)


if __name__ == "__main__":
    unittest.main()
