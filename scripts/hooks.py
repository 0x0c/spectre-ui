"""MkDocs のビルドフック。

`docs/` 以下のページに書かれたリンクを、サイト上で解決できる形に直す
（詳細は `scripts/site_links.py`）。`roadmaps/` は取り込み時に
`scripts/gen_roadmap_pages.py` が同じ処理を行うため、ここでは触らない。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_links  # noqa: E402

# gen-files が作ったページは生成時に変換済みなので、二重に変換しない
GENERATED_PREFIX = "roadmaps/"


def on_page_markdown(markdown: str, *, page, config, files) -> str:
    site_path = page.file.src_uri
    if site_path.startswith(GENERATED_PREFIX):
        return markdown
    return site_links.rewrite(markdown, f"docs/{site_path}", site_path)
