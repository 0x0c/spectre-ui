"""リポジトリ相対のリンクを、ドキュメントサイト上のリンクに翻訳する。

ドキュメントは GitHub 上でそのまま読めることを優先し、リンクは**リポジトリの
ファイル配置**に対して正しい形で書かれている。サイトの構成はそれと一致しない。

| リポジトリ上のパス | サイト上の扱い |
| --- | --- |
| `docs/**` | `docs_dir` なので、`docs/` を取り除いたパスになる |
| それ以外 (`roadmaps/`, `spec/`, `examples/`, `.agent-workflows/` など) | サイトに含まれないので GitHub の絶対URLにする |

ロードマップ項目の本文はサイトに載せず、一覧ページ
(`scripts/build_roadmap_index.py`) から GitHub へ送る。

いずれの場合も、リンク元ページのサイト上の位置からの相対パスに直す。
"""

from __future__ import annotations

import posixpath
import re

GITHUB_BLOB = "https://github.com/0x0c/spectre-ui/blob/main"

# Markdown のリンクとイメージ。タイトル付き `](path "title")` にも対応する。
_LINK_RE = re.compile(r'(?<=\])\((?!<)([^()\s]+?)(\s+"[^"]*")?\)')

_ABSOLUTE = re.compile(r"\A(?:[a-z][a-z0-9+.-]*:|//|#)")


def repo_to_site(repo_path: str) -> str | None:
    """リポジトリ相対パス → サイト（docs_dir）相対パス。サイト外なら None。"""
    if repo_path.startswith("docs/"):
        return repo_path[len("docs/") :]
    return None


def rewrite(markdown: str, source_repo_path: str, page_site_path: str) -> str:
    """`source_repo_path` に書かれたリンクを `page_site_path` から見た形に直す。

    引数はどちらもファイル自身のパス（ディレクトリではない）。
    """
    source_dir = posixpath.dirname(source_repo_path)
    page_dir = posixpath.dirname(page_site_path)

    def replace(match: re.Match[str]) -> str:
        target, title = match.group(1), match.group(2) or ""
        if _ABSOLUTE.match(target):
            return match.group(0)

        path, _, anchor = target.partition("#")
        if not path:  # 同一ページ内アンカー
            return match.group(0)

        repo_target = posixpath.normpath(posixpath.join(source_dir, path))
        site_target = repo_to_site(repo_target)

        if site_target is None or not site_target.endswith(".md"):
            # サイトに存在しないファイル（JSON、リポジトリ外のディレクトリなど）
            new = f"{GITHUB_BLOB}/{repo_target}"
        else:
            new = posixpath.relpath(site_target, page_dir or ".")
        if anchor:
            new = f"{new}#{anchor}"
        return f"({new}{title})"

    return _LINK_RE.sub(replace, markdown)
