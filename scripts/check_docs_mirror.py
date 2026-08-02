"""`docs/` 以下の言語ペアが揃っているかを確認する。

`X.md`（英語）には同じディレクトリに `X-ja.md`（日本語）が、`X-ja.md` には `X.md` が、
それぞれ必ず対になっていることを確認する。片方だけが存在する場合はビルドを落とす。

`docs/spec/` は対象外とする。仕様4文書は SU-0011 の設計どおり、マイルストーン M0 が
仕様を凍結するまで日本語のみで残る既知の例外であり、対にならないことを承知の上で
除外している（CLAUDE.md の「Documents come in pairs」を参照）。
"""

from __future__ import annotations

import sys
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
EXCLUDED_DIRS = {DOCS_DIR / "spec"}


def is_excluded(path: Path) -> bool:
    return any(path == d or d in path.parents for d in EXCLUDED_DIRS)


def main() -> int:
    missing: list[str] = []

    for path in sorted(DOCS_DIR.rglob("*.md")):
        if is_excluded(path):
            continue

        if path.stem.endswith("-ja"):
            counterpart = path.with_name(path.stem[: -len("-ja")] + ".md")
        else:
            counterpart = path.with_name(path.stem + "-ja.md")

        if not counterpart.exists():
            missing.append(
                f"{path.relative_to(DOCS_DIR.parent)} has no counterpart "
                f"({counterpart.relative_to(DOCS_DIR.parent)} is missing)"
            )

    if missing:
        print("docs/ language mirror check failed:", file=sys.stderr)
        for line in missing:
            print(f"  - {line}", file=sys.stderr)
        return 1

    print("docs/ language mirror check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
