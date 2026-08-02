"""Unit tests for `scripts/check_docs_mirror.py`.

This script is the only mechanism enforcing CLAUDE.md's rule that documents come in pairs. Its
job is to fail a change that updated only one language, so the real failure is **not catching
one** — checking only the passing side proves nothing. It has to be shown actually detecting a
missing counterpart.

`DOCS_DIR` and `EXCLUDED_DIRS` are module constants, so they are pointed at a synthetic docs
tree for the duration of each test.
"""

from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import check_docs_mirror as M  # noqa: E402


@contextlib.contextmanager
def docs_tree(*relative_paths: str, excluded: tuple[str, ...] = ("spec",)):
    """Build a synthetic `docs/` and point the module constants at it."""
    with tempfile.TemporaryDirectory() as tmp:
        docs = Path(tmp) / "docs"
        for relative in relative_paths:
            path = docs / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("# stub\n", encoding="utf-8")
        docs.mkdir(exist_ok=True)

        original_dir, original_excluded = M.DOCS_DIR, M.EXCLUDED_DIRS
        M.DOCS_DIR = docs
        M.EXCLUDED_DIRS = {docs / name for name in excluded}
        try:
            yield docs
        finally:
            M.DOCS_DIR, M.EXCLUDED_DIRS = original_dir, original_excluded


def run_main() -> tuple[int, str]:
    """Run `main()` and return (exit code, stderr)."""
    stderr = io.StringIO()
    with contextlib.redirect_stderr(stderr), contextlib.redirect_stdout(io.StringIO()):
        code = M.main()
    return code, stderr.getvalue()


class IsExcludedTest(unittest.TestCase):
    def test_the_excluded_directory_itself_and_its_contents(self):
        with docs_tree() as docs:
            self.assertTrue(M.is_excluded(docs / "spec"))
            self.assertTrue(M.is_excluded(docs / "spec" / "schema.md"))
            self.assertTrue(M.is_excluded(docs / "spec" / "nested" / "deep.md"))

    def test_other_paths_are_not_excluded(self):
        with docs_tree() as docs:
            self.assertFalse(M.is_excluded(docs / "architecture.md"))
            self.assertFalse(M.is_excluded(docs / "adr" / "README.md"))
            # A sibling that merely shares a name prefix is not excluded.
            self.assertFalse(M.is_excluded(docs / "specification.md"))


class MainTest(unittest.TestCase):
    def test_a_complete_pair_passes(self):
        with docs_tree("architecture.md", "architecture-ja.md"):
            code, _ = run_main()
        self.assertEqual(code, 0)

    def test_an_empty_docs_tree_passes(self):
        with docs_tree():
            code, _ = run_main()
        self.assertEqual(code, 0)

    def test_a_missing_japanese_counterpart_fails(self):
        with docs_tree("architecture.md"):
            code, stderr = run_main()
        self.assertEqual(code, 1)
        self.assertIn("architecture-ja.md", stderr)

    def test_a_missing_english_counterpart_fails(self):
        # A Japanese-only addition fails the same way. English leads, so this is the likelier
        # of the two.
        with docs_tree("architecture-ja.md"):
            code, stderr = run_main()
        self.assertEqual(code, 1)
        self.assertIn("architecture.md", stderr)

    def test_pairs_are_matched_within_the_same_directory(self):
        # Same-named files in different directories are not a pair.
        with docs_tree("adr/README.md", "README-ja.md"):
            code, _ = run_main()
        self.assertEqual(code, 1)

    def test_nested_pairs_are_checked(self):
        with docs_tree("adr/README.md", "adr/README-ja.md"):
            code, _ = run_main()
        self.assertEqual(code, 0)

    def test_the_excluded_directory_may_be_japanese_only(self):
        # docs/spec/ is the known exception, staying Japanese-only until M0 freezes the spec.
        with docs_tree("spec/schema.md", "spec/expression.md"):
            code, _ = run_main()
        self.assertEqual(code, 0)

    def test_the_exclusion_does_not_leak_to_siblings(self):
        with docs_tree("spec/schema.md", "architecture.md"):
            code, stderr = run_main()
        self.assertEqual(code, 1)
        self.assertIn("architecture", stderr)
        self.assertNotIn("spec/schema", stderr)

    def test_every_missing_counterpart_is_reported(self):
        with docs_tree("a.md", "b.md", "c.md", "c-ja.md"):
            code, stderr = run_main()
        self.assertEqual(code, 1)
        self.assertIn("a-ja.md", stderr)
        self.assertIn("b-ja.md", stderr)
        self.assertNotIn("c-ja.md", stderr)


class RealDocsTest(unittest.TestCase):
    def test_the_repository_docs_are_paired(self):
        code, stderr = run_main()
        self.assertEqual(code, 0, stderr)


if __name__ == "__main__":
    unittest.main()
