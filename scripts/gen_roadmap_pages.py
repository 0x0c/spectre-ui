"""`roadmaps/` をドキュメントサイトへ取り込み、一覧ページとナビを生成する。

情報源はリポジトリ直下の `roadmaps/`（1項目1ディレクトリ、日英2ファイル）。
規約は `roadmaps/README.md` を参照。ここでは何も書き換えず、ビルド時に次を生成する。

* `roadmaps/SU-NNNN-<slug>/*.md` — 項目ページ。ディレクトリ構造を保ったまま取り込み、
  リンクだけサイト用に直す（`scripts/site_links.py`）。
* `roadmaps/index.md` / `roadmaps/index-en.md` — 一覧。各項目の `SU-METADATA` から
  Status と Topic を読み、ステータス別・トピック別の表を作る。
* `roadmaps/conventions.md` / `conventions-ja.md` — `roadmaps/README.md` とその日本語版。
* `roadmaps/SUMMARY.md` — literate-nav 用のナビゲーション定義。

mkdocs-gen-files のスクリプトとして実行される。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import mkdocs_gen_files

sys.path.insert(0, str(Path(__file__).resolve().parent))
import site_links  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAPS_DIR = REPO_ROOT / "roadmaps"
OUT = "roadmaps"

# roadmaps/README.md の "Status values" と対応する。表示順もこの順。
STATUS_ORDER = ["In progress", "Proposal", "Implemented", "Proposal (deferred)"]
STATUS_JA = {
    "In progress": "実装中",
    "Proposal": "提案",
    "Implemented": "実装済み",
    "Proposal (deferred)": "提案（保留）",
}
STATUS_MEANING_JA = {
    "In progress": "採択され、実装が進んでいる。",
    "Proposal": "検討中。まだ着手していない。",
    "Implemented": "実装が出荷された。",
    "Proposal (deferred)": "意図的に保留している。",
}
STATUS_MEANING_EN = {
    "In progress": "Accepted and actively being built.",
    "Proposal": "Under consideration, not yet started.",
    "Implemented": "Shipped.",
    "Proposal (deferred)": "Deliberately parked.",
}

# 日本語ファイルの状態表記 → 正規化した Status
STATUS_FROM_JA = {
    "提案": "Proposal",
    "実装中": "In progress",
    "実装済み": "Implemented",
    "提案（保留）": "Proposal (deferred)",
    "提案 (保留)": "Proposal (deferred)",
}

TOPIC_JA_FALLBACK = "その他"

_METADATA_RE = re.compile(r"<!-- SU-METADATA -->(.*?)<!-- /SU-METADATA -->", re.DOTALL)
_ROW_RE = re.compile(r"^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$", re.MULTILINE)
_TITLE_RE = re.compile(r"^#\s+(.*)$", re.MULTILINE)
_BOLD_RE = re.compile(r"\*\*(.*?)\*\*")


def _metadata(text: str, source: Path) -> dict[str, str]:
    match = _METADATA_RE.search(text)
    if not match:
        raise ValueError(f"{source}: SU-METADATA ブロックがない")
    fields = {}
    for key, value in _ROW_RE.findall(match.group(1)):
        if key in ("Field", "項目") or set(key) <= set("-: "):
            continue  # 見出し行と区切り行
        fields[key] = value
    return fields


def _title(text: str, source: Path) -> str:
    match = _TITLE_RE.search(text)
    if not match:
        raise ValueError(f"{source}: H1 見出しがない")
    # "SU-0009 — 実機ミラープレビュー" から ID を落とす
    title = match.group(1).strip()
    return re.sub(r"^SU-\d{4}\s*[—–-]\s*", "", title)


class Item:
    """1つのロードマップ項目（日英2ファイル）。"""

    def __init__(self, directory: Path):
        self.slug = directory.name
        self.id = self.slug[:7]  # SU-NNNN

        self.en_path = directory / f"{self.slug}.md"
        self.ja_path = directory / f"{self.slug}-ja.md"
        for path in (self.en_path, self.ja_path):
            if not path.is_file():
                raise ValueError(f"{path} がない（roadmaps/README.md の規約を参照）")

        en = self.en_path.read_text(encoding="utf-8")
        ja = self.ja_path.read_text(encoding="utf-8")
        self.en_text, self.ja_text = en, ja

        en_meta = _metadata(en, self.en_path)
        ja_meta = _metadata(ja, self.ja_path)

        self.title_en = _title(en, self.en_path)
        self.title_ja = _title(ja, self.ja_path)
        self.topic_en = en_meta.get("Topic", "Other")
        self.topic_ja = ja_meta.get("トピック", TOPIC_JA_FALLBACK)
        self.author = en_meta.get("Author", "")

        status = _BOLD_RE.sub(r"\1", en_meta.get("Status", "Proposal")).strip()
        if status not in STATUS_ORDER:
            # 日本語ファイル側の表記からも拾えるようにしておく
            status_ja = _BOLD_RE.sub(r"\1", ja_meta.get("状態", "")).strip()
            status = STATUS_FROM_JA.get(status_ja, "")
        if status not in STATUS_ORDER:
            raise ValueError(f"{self.en_path}: 未知の Status: {en_meta.get('Status')!r}")
        self.status = status

    # --- サイト上のパス -------------------------------------------------
    @property
    def en_doc(self) -> str:
        return f"{OUT}/{self.slug}/{self.slug}.md"

    @property
    def ja_doc(self) -> str:
        return f"{OUT}/{self.slug}/{self.slug}-ja.md"

    @property
    def en_link(self) -> str:
        return f"{self.slug}/{self.slug}.md"

    @property
    def ja_link(self) -> str:
        return f"{self.slug}/{self.slug}-ja.md"


def load_items() -> list[Item]:
    items = [Item(d) for d in sorted(ROADMAPS_DIR.glob("SU-*")) if d.is_dir()]
    if not items:
        raise ValueError(f"{ROADMAPS_DIR} に項目がない")
    ids = [i.id for i in items]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"ID が重複している: {duplicates}")
    return items


def _emit(repo_path: str, site_path: str, text: str) -> None:
    with mkdocs_gen_files.open(site_path, "w") as fd:
        fd.write(site_links.rewrite(text, repo_path, site_path))
    # edit_uri は docs/ 基準なので、docs/ の外を指すには ../ で抜ける
    mkdocs_gen_files.set_edit_path(site_path, f"../{repo_path}")


def write_item_pages(items: list[Item]) -> None:
    for item in items:
        _emit(f"roadmaps/{item.slug}/{item.slug}.md", item.en_doc, item.en_text)
        _emit(f"roadmaps/{item.slug}/{item.slug}-ja.md", item.ja_doc, item.ja_text)


def write_conventions() -> None:
    """roadmaps/README.md と README-ja.md を規約ページとして取り込む。

    `README.md` のままだと生成する `index.md`（項目一覧）と衝突するため、
    `site_links.RENAMED` に従って名前を変える。README への参照も同じ表で追随する。
    """
    for repo_name in ("README.md", "README-ja.md"):
        repo_path = f"roadmaps/{repo_name}"
        site_path = site_links.RENAMED[repo_path]
        text = (ROADMAPS_DIR / repo_name).read_text(encoding="utf-8")
        _emit(repo_path, site_path, text)


def _counts(items: list[Item]) -> dict[str, int]:
    counts = {status: 0 for status in STATUS_ORDER}
    for item in items:
        counts[item.status] += 1
    return counts


def write_index_ja(items: list[Item]) -> None:
    counts = _counts(items)
    out = [
        "# ロードマップ項目一覧",
        "",
        f"ロードマップは1項目1ディレクトリで管理している（全 {len(items)} 件）。"
        "このページは各項目の `SU-METADATA` から生成しているので、項目を追加すれば自動で載る。",
        "",
        "採番と記述の規約は [ロードマップの規約](conventions-ja.md)、"
        "マイルストーンの全体像と見積もりは [ロードマップと未決事項](../roadmap.md) を参照。",
        "",
        "## 件数",
        "",
        "| 状態 | 意味 | 件数 |",
        "| --- | --- | --- |",
    ]
    for status in STATUS_ORDER:
        out.append(
            f"| {STATUS_JA[status]} (`{status}`) | {STATUS_MEANING_JA[status]} | {counts[status]} |"
        )

    out += ["", "## 状態別", ""]
    for status in STATUS_ORDER:
        selected = [i for i in items if i.status == status]
        out += [f"### {STATUS_JA[status]}", ""]
        if not selected:
            out += ["該当なし。", ""]
            continue
        out += ["| ID | 項目 | トピック | English |", "| --- | --- | --- | --- |"]
        for item in selected:
            out.append(
                f"| `{item.id}` | [{item.title_ja}]({item.ja_link}) "
                f"| {item.topic_ja} | [EN]({item.en_link}) |"
            )
        out.append("")

    out += ["## トピック別", ""]
    for topic in sorted({i.topic_ja for i in items}):
        selected = [i for i in items if i.topic_ja == topic]
        out += [
            f"### {topic}",
            "",
            "| ID | 項目 | 状態 |",
            "| --- | --- | --- |",
        ]
        for item in selected:
            out.append(
                f"| `{item.id}` | [{item.title_ja}]({item.ja_link}) "
                f"| {STATUS_JA[item.status]} |"
            )
        out.append("")

    with mkdocs_gen_files.open(f"{OUT}/index.md", "w") as fd:
        fd.write("\n".join(out).rstrip() + "\n")
    mkdocs_gen_files.set_edit_path(f"{OUT}/index.md", "../scripts/gen_roadmap_pages.py")


def write_index_en(items: list[Item]) -> None:
    counts = _counts(items)
    out = [
        "# Roadmap items",
        "",
        f"The roadmap is one directory per item ({len(items)} in total). "
        "This page is generated from each item's `SU-METADATA` block, so a new item "
        "appears here without touching an index by hand.",
        "",
        "See [roadmap conventions](conventions.md) for the numbering and writing rules, "
        "and [the milestone overview](../roadmap.md) for estimates and open questions "
        "(Japanese).",
        "",
        "## Counts",
        "",
        "| Status | Meaning | Count |",
        "| --- | --- | --- |",
    ]
    for status in STATUS_ORDER:
        out.append(f"| `{status}` | {STATUS_MEANING_EN[status]} | {counts[status]} |")

    out += ["", "## By status", ""]
    for status in STATUS_ORDER:
        selected = [i for i in items if i.status == status]
        out += [f"### {status}", ""]
        if not selected:
            out += ["None.", ""]
            continue
        out += ["| ID | Item | Topic | 日本語 |", "| --- | --- | --- | --- |"]
        for item in selected:
            out.append(
                f"| `{item.id}` | [{item.title_en}]({item.en_link}) "
                f"| {item.topic_en} | [JA]({item.ja_link}) |"
            )
        out.append("")

    out += ["## By topic", ""]
    for topic in sorted({i.topic_en for i in items}):
        selected = [i for i in items if i.topic_en == topic]
        out += [f"### {topic}", "", "| ID | Item | Status |", "| --- | --- | --- |"]
        for item in selected:
            out.append(
                f"| `{item.id}` | [{item.title_en}]({item.en_link}) | {item.status} |"
            )
        out.append("")

    with mkdocs_gen_files.open(f"{OUT}/index-en.md", "w") as fd:
        fd.write("\n".join(out).rstrip() + "\n")
    mkdocs_gen_files.set_edit_path(
        f"{OUT}/index-en.md", "../scripts/gen_roadmap_pages.py"
    )


def write_summary(items: list[Item]) -> None:
    lines = [
        "- [項目一覧](index.md)",
        "- [Roadmap items (English)](index-en.md)",
        "- [ロードマップの規約](conventions-ja.md)",
    ]
    for item in items:
        lines.append(f"- [{item.id} {item.title_ja}]({item.ja_link})")
    with mkdocs_gen_files.open(f"{OUT}/SUMMARY.md", "w") as fd:
        fd.write("\n".join(lines) + "\n")


items = load_items()
write_item_pages(items)
write_conventions()
write_index_ja(items)
write_index_en(items)
write_summary(items)
