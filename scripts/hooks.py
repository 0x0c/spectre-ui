"""MkDocs のビルドフック。

`docs/` 以下のページに書かれたリンクを、サイト上で解決できる形に直す
（詳細は `scripts/site_links.py`）。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_links  # noqa: E402


def on_page_markdown(markdown: str, *, page, config, files) -> str:
    src = page.file.src_uri
    return site_links.rewrite(markdown, f"docs/{src}", src)
