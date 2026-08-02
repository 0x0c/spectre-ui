"""Unit tests for `scripts/site_links.py`.

Link rewriting takes links written to be readable as-is on GitHub and adapts them for the
differently-shaped documentation site (see the header of `scripts/site_links.py`). A mistake
surfaces not as a broken link that `mkdocs build --strict` would catch, but as a **live link
pointing at the wrong place** — the build stays green and nobody notices. The rules are pinned
here.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from site_links import GITHUB_BLOB, repo_to_site, rewrite  # noqa: E402


class RepoToSiteTest(unittest.TestCase):
    def test_docs_prefix_is_stripped(self):
        self.assertEqual(repo_to_site("docs/architecture.md"), "architecture.md")
        self.assertEqual(repo_to_site("docs/adr/README.md"), "adr/README.md")

    def test_paths_outside_docs_are_not_on_the_site(self):
        for path in ("roadmaps/SU-0001/x.md", "spec/schema.json", "README.md", "docsy/x.md"):
            with self.subTest(path=path):
                self.assertIsNone(repo_to_site(path))


class RewriteTest(unittest.TestCase):
    """`rewrite(markdown, source_repo_path, page_site_path)`."""

    def rewrite_from_docs_root(self, markdown: str) -> str:
        """Rewrite as a link written in `docs/index.md`, which is `index.md` on the site."""
        return rewrite(markdown, "docs/index.md", "index.md")

    def test_link_to_a_sibling_doc_stays_relative(self):
        self.assertEqual(
            self.rewrite_from_docs_root("[a](architecture.md)"),
            "[a](architecture.md)",
        )

    def test_link_into_a_subdirectory_of_docs(self):
        self.assertEqual(
            self.rewrite_from_docs_root("[a](adr/README.md)"),
            "[a](adr/README.md)",
        )

    def test_link_from_a_nested_page_becomes_relative_to_that_page(self):
        # docs/adr/X.md sits at adr/X.md on the site too, so a link from there to
        # docs/architecture.md has to climb one level.
        self.assertEqual(
            rewrite("[a](../architecture.md)", "docs/adr/X.md", "adr/X.md"),
            "[a](../architecture.md)",
        )

    def test_link_outside_docs_becomes_a_github_url(self):
        # roadmaps/ is not part of the site.
        self.assertEqual(
            self.rewrite_from_docs_root("[a](../roadmaps/README.md)"),
            f"[a]({GITHUB_BLOB}/roadmaps/README.md)",
        )

    def test_link_to_a_non_markdown_file_becomes_a_github_url(self):
        # Only .md files are placed on the site; JSON points back at the repository.
        self.assertEqual(
            self.rewrite_from_docs_root("[a](../spec/component-manifest.json)"),
            f"[a]({GITHUB_BLOB}/spec/component-manifest.json)",
        )

    def test_non_markdown_inside_docs_also_goes_to_github(self):
        self.assertEqual(
            self.rewrite_from_docs_root("[a](assets/diagram.png)"),
            f"[a]({GITHUB_BLOB}/docs/assets/diagram.png)",
        )

    def test_anchors_are_preserved(self):
        self.assertEqual(
            self.rewrite_from_docs_root("[a](architecture.md#section-5)"),
            "[a](architecture.md#section-5)",
        )
        self.assertEqual(
            self.rewrite_from_docs_root("[a](../roadmaps/README.md#status)"),
            f"[a]({GITHUB_BLOB}/roadmaps/README.md#status)",
        )

    def test_same_page_anchors_are_left_alone(self):
        self.assertEqual(self.rewrite_from_docs_root("[a](#section)"), "[a](#section)")

    def test_absolute_urls_are_left_alone(self):
        for target in (
            "https://example.com/x.md",
            "http://example.com",
            "mailto:a@example.com",
            "//example.com/x",
        ):
            with self.subTest(target=target):
                self.assertEqual(
                    self.rewrite_from_docs_root(f"[a]({target})"),
                    f"[a]({target})",
                )

    def test_link_titles_are_preserved(self):
        self.assertEqual(
            self.rewrite_from_docs_root('[a](architecture.md "The title")'),
            '[a](architecture.md "The title")',
        )
        self.assertEqual(
            self.rewrite_from_docs_root('[a](../roadmaps/README.md "T")'),
            f'[a]({GITHUB_BLOB}/roadmaps/README.md "T")',
        )

    def test_images_are_rewritten_too(self):
        self.assertEqual(
            self.rewrite_from_docs_root("![alt](../spec/diagram.svg)"),
            f"![alt]({GITHUB_BLOB}/spec/diagram.svg)",
        )

    def test_multiple_links_in_one_document(self):
        markdown = "See [a](architecture.md) and [b](../roadmaps/README.md)."
        self.assertEqual(
            self.rewrite_from_docs_root(markdown),
            f"See [a](architecture.md) and [b]({GITHUB_BLOB}/roadmaps/README.md).",
        )

    def test_parentheses_that_are_not_links_are_left_alone(self):
        # Without a preceding `]` it is not a link.
        markdown = "A sentence (with parentheses) and a word."
        self.assertEqual(self.rewrite_from_docs_root(markdown), markdown)

    def test_path_traversal_is_normalized(self):
        self.assertEqual(
            self.rewrite_from_docs_root("[a](./adr/../architecture.md)"),
            "[a](architecture.md)",
        )


if __name__ == "__main__":
    unittest.main()
