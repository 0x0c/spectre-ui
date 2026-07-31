"""`roadmaps/` のロードマップ項目を読み込む。

情報源はリポジトリ直下の `roadmaps/`（1項目1ディレクトリ、日英2ファイル）。
書式の規約は `roadmaps/README.md` にある。ここでは読むだけで、何も書き換えない。
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAPS_DIR = REPO_ROOT / "roadmaps"
GITHUB_BLOB = "https://github.com/0x0c/spectre-ui/blob/main"

# roadmaps/README.md の "Status values" と対応する。一覧の表示順もこの順。
STATUS_ORDER = ["In progress", "Proposal", "Implemented", "Proposal (deferred)"]
STATUS_JA = {
    "In progress": "実装中",
    "Proposal": "提案",
    "Implemented": "実装済み",
    "Proposal (deferred)": "保留",
}
# 状態は色だけでなく記号とラベルでも示す
STATUS_MARK = {
    "In progress": "◐",
    "Proposal": "○",
    "Implemented": "●",
    "Proposal (deferred)": "◌",
}
STATUS_FROM_JA = {
    "提案": "Proposal",
    "実装中": "In progress",
    "実装済み": "Implemented",
    "提案（保留）": "Proposal (deferred)",
    "提案 (保留)": "Proposal (deferred)",
}

_METADATA_RE = re.compile(r"<!-- SU-METADATA -->(.*?)<!-- /SU-METADATA -->", re.DOTALL)
_ROW_RE = re.compile(r"^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$", re.MULTILINE)
_TITLE_RE = re.compile(r"^#\s+(.*)$", re.MULTILINE)
_BOLD_RE = re.compile(r"\*\*(.*?)\*\*")
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_CODE_RE = re.compile(r"`([^`]*)`")
_CHECKBOX_RE = re.compile(r"^\s*-\s+\[([ xX])\]\s*(.*)$", re.MULTILINE)
_NUMBERED_RE = re.compile(r"^\d+\.\s+(.*)$", re.MULTILINE)

# 未着手の項目が置く「箱1つだけ」のプレースホルダ（roadmaps/README.md の規約）
_PLACEHOLDERS = {"未着手", "not started"}


def _plain(markdown: str) -> str:
    """リンク・強調・コード記法を落として、素の文にする。"""
    text = _LINK_RE.sub(r"\1", markdown)
    text = _BOLD_RE.sub(r"\1", text)
    text = _CODE_RE.sub(r"\1", text)
    text = text.replace("*", "")
    return re.sub(r"\s+", " ", text).strip()


def _metadata(text: str, source: Path) -> dict[str, str]:
    match = _METADATA_RE.search(text)
    if not match:
        raise ValueError(f"{source}: SU-METADATA ブロックがない")
    fields: dict[str, str] = {}
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
    return re.sub(r"^SU-\d{4}\s*[—–-]\s*", "", match.group(1).strip())


def _lede(text: str, headings: tuple[str, ...]) -> str:
    """最初の節（はじめに / Introduction）の第1段落を要約として使う。"""
    for heading in headings:
        match = re.search(
            rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)",
            text,
            re.MULTILINE | re.DOTALL,
        )
        if not match:
            continue
        for paragraph in match.group(1).strip().split("\n\n"):
            paragraph = paragraph.strip()
            if paragraph and not paragraph.startswith(("<!--", "|", "-", "*")):
                return _plain(paragraph)
    return ""


def _section(text: str, headings: tuple[str, ...]) -> str:
    for heading in headings:
        match = re.search(
            rf"^##\s+{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)",
            text,
            re.MULTILINE | re.DOTALL,
        )
        if match:
            return match.group(1)
    return ""


def _progress(text: str, design_headings: tuple[str, ...], progress_headings: tuple[str, ...]):
    """(完了数, 作業単位数, 見込みかどうか) を返す。

    `Progress` のチェックリストが正。ただし未着手の項目は「未着手」の箱を1つ置くだけなので、
    それでは作業の量が分からない。その場合だけ `Detailed design` の番号付き項目数を
    作業単位数の**見込み**として使い、完了数は 0 とする（規約上、両者は1対1で対応する）。
    """
    boxes = _CHECKBOX_RE.findall(_section(text, progress_headings))
    done = sum(1 for mark, _ in boxes if mark.lower() == "x")
    placeholder = len(boxes) == 1 and _plain(boxes[0][1]).strip().lower() in _PLACEHOLDERS
    if boxes and not placeholder:
        return done, len(boxes), False
    units = len(_NUMBERED_RE.findall(_section(text, design_headings)))
    return 0, units or len(boxes), True


class Item:
    """1つのロードマップ項目（日英2ファイル）。"""

    def __init__(self, directory: Path):
        self.slug = directory.name
        self.id = self.slug[:7]  # SU-NNNN

        en_path = directory / f"{self.slug}.md"
        ja_path = directory / f"{self.slug}-ja.md"
        for path in (en_path, ja_path):
            if not path.is_file():
                raise ValueError(f"{path} がない（roadmaps/README.md の規約を参照）")

        en = en_path.read_text(encoding="utf-8")
        ja = ja_path.read_text(encoding="utf-8")

        en_meta = _metadata(en, en_path)
        ja_meta = _metadata(ja, ja_path)

        self.title_en = _title(en, en_path)
        self.title_ja = _title(ja, ja_path)
        self.topic_en = en_meta.get("Topic", "Other")
        self.topic_ja = ja_meta.get("トピック", "その他")
        self.author = _plain(en_meta.get("Author", ""))
        self.lede_ja = _lede(ja, ("はじめに",))
        self.lede_en = _lede(en, ("Introduction",))
        self.done, self.units, self.units_estimated = _progress(
            ja, ("詳細設計",), ("進捗",)
        )
        if not self.units:  # 日本語側から数えられなければ英語側で
            self.done, self.units, self.units_estimated = _progress(
                en, ("Detailed design",), ("Progress",)
            )

        status = _BOLD_RE.sub(r"\1", en_meta.get("Status", "")).strip()
        if status not in STATUS_ORDER:
            # 日本語ファイル側の表記からも拾えるようにしておく
            status_ja = _BOLD_RE.sub(r"\1", ja_meta.get("状態", "")).strip()
            status = STATUS_FROM_JA.get(status_ja, "")
        if status not in STATUS_ORDER:
            raise ValueError(f"{en_path}: 未知の Status: {en_meta.get('Status')!r}")
        self.status = status

        self.url_ja = f"{GITHUB_BLOB}/roadmaps/{self.slug}/{self.slug}-ja.md"
        self.url_en = f"{GITHUB_BLOB}/roadmaps/{self.slug}/{self.slug}.md"

    @property
    def number(self) -> int:
        return int(self.id.split("-")[1])


def load_items() -> list[Item]:
    items = [Item(d) for d in sorted(ROADMAPS_DIR.glob("SU-*")) if d.is_dir()]
    if not items:
        raise ValueError(f"{ROADMAPS_DIR} に項目がない")
    ids = [i.id for i in items]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"ID が重複している: {duplicates}")
    return items
