"""ロードマップ一覧ページ（サイトのトップ）を生成する。

`roadmaps/` の各項目の `SU-METADATA` と冒頭の1段落から、1枚のリストページを作る。
項目の本文そのものはリポジトリ（GitHub）に置いたままにし、ここでは**一覧に徹する**。

    python3 scripts/build_roadmap_index.py [出力先ディレクトリ]

既定の出力先は `site/`（MkDocs のドキュメントは `site/docs/` に置く）。
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import roadmap_items as R  # noqa: E402

REPO_URL = "https://github.com/0x0c/spectre-ui"
DOCS_PATH = "docs/"  # サイト内のドキュメント（MkDocs）の位置

STYLE = """
:root {
  color-scheme: light;
  --page: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --ink-muted: #898781;
  --rule: #e1e0d9;
  --rule-strong: #c3c2b7;
  --accent: #1c5cab;
  --chip: #f2f1ed;
  --good: #0ca30c;
  --warning: #a06a00;
  --sans: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP",
    "Yu Gothic UI", Meiryo, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #131312;
    --ink: #ffffff;
    --ink-2: #c3c2b7;
    --ink-muted: #898781;
    --rule: #2c2c2a;
    --rule-strong: #383835;
    --accent: #6da7ec;
    --chip: #1f1f1d;
    --good: #0ca30c;
    --warning: #fab219;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-underline-offset: 3px; }

.wrap { width: min(760px, 100% - 44px); margin-inline: auto; }

/* ---------------------------------------------------------------- header */

header.top { padding: 72px 0 0; }

header.top h1 {
  font-size: 28px;
  font-weight: 640;
  letter-spacing: -0.02em;
  margin: 0;
}

header.top p.lede {
  margin: 10px 0 0;
  color: var(--ink-2);
  max-width: 56ch;
}

header.top .meta {
  margin-top: 18px;
  font-size: 13px;
  color: var(--ink-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
}

header.top .meta a { color: var(--ink-2); }
header.top .meta a:hover { color: var(--accent); }

/* --------------------------------------------------------------- filters */

.controls {
  margin: 40px 0 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--rule-strong);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 10px;
}

.row .label {
  font-size: 12px;
  color: var(--ink-muted);
  min-width: 3.5em;
  letter-spacing: 0.04em;
}

button.chip {
  font: inherit;
  font-size: 13px;
  color: var(--ink-2);
  background: none;
  border: 0;
  border-radius: 999px;
  padding: 3px 11px;
  cursor: pointer;
  white-space: nowrap;
}

button.chip:hover { background: var(--chip); color: var(--ink); }

button.chip[aria-pressed="true"] {
  background: var(--ink);
  color: var(--page);
}

button.chip .n {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
  margin-inline-start: 5px;
}

/* ------------------------------------------------------------------ list */

ol.items { list-style: none; margin: 0; padding: 0; }

ol.items > li { border-bottom: 1px solid var(--rule); }

ol.items > li.hidden { display: none; }

.item {
  display: grid;
  grid-template-columns: 5.5rem 1fr auto;
  gap: 4px 20px;
  padding: 22px 0;
  align-items: baseline;
}

@media (max-width: 620px) {
  .item {
    grid-template-columns: 1fr auto;
  }
  .item .id { grid-column: 1; }
  .item .status { grid-column: 2; justify-self: end; }
  .item .body { grid-column: 1 / -1; }
}

.item .id {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--ink-muted);
  letter-spacing: 0.02em;
}

.item .body { min-width: 0; }

.item h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 620;
  letter-spacing: -0.01em;
  line-height: 1.5;
}

.item h2 a { color: var(--ink); text-decoration: none; }
.item h2 a:hover { color: var(--accent); text-decoration: underline; }

/* 一覧の走査性を保つため3行で切る。全文は項目のリンク先にある。 */
.item p.lede {
  margin: 6px 0 0;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.75;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}

.item .tags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12.5px;
  color: var(--ink-muted);
}

.item .tags .topic {
  background: var(--chip);
  border-radius: 4px;
  padding: 1px 8px;
}

.item .tags a { color: var(--ink-muted); }
.item .tags a:hover { color: var(--accent); }

.item .status {
  font-size: 12.5px;
  white-space: nowrap;
  color: var(--ink-2);
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.item .status .mark { font-size: 11px; }
.item .status[data-status="Implemented"] { color: var(--good); }
.item .status[data-status="In progress"] { color: var(--warning); }
.item .status[data-status="Proposal (deferred)"] { color: var(--ink-muted); }

.empty {
  padding: 40px 0;
  color: var(--ink-muted);
  font-size: 14px;
}

/* ---------------------------------------------------------------- footer */

footer.bottom {
  padding: 32px 0 72px;
  color: var(--ink-muted);
  font-size: 12.5px;
}

footer.bottom p { margin: 4px 0; }
footer.bottom a { color: var(--ink-muted); }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
"""

SCRIPT = """
(function () {
  var state = { status: "all", topic: "all", lang: "ja" };
  var list = document.getElementById("items");
  var rows = Array.prototype.slice.call(list.querySelectorAll("li"));
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");

  function apply() {
    document.body.setAttribute("data-lang", state.lang);
    var shown = 0;
    rows.forEach(function (row) {
      var ok =
        (state.status === "all" || row.dataset.status === state.status) &&
        (state.topic === "all" || row.dataset.topic === state.topic);
      row.classList.toggle("hidden", !ok);
      if (ok) shown++;
    });
    count.textContent = shown;
    empty.hidden = shown !== 0;

    rows.forEach(function (row) {
      row.querySelectorAll("[data-ja]").forEach(function (el) {
        el.textContent = el.dataset[state.lang];
      });
      var link = row.querySelector("a.title-link");
      link.href =
        state.lang === "ja" ? link.dataset.hrefJa : link.dataset.hrefEn;
    });
  }

  document.querySelectorAll("button.chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var group = chip.dataset.group;
      state[group] = chip.dataset.value;
      document
        .querySelectorAll('button.chip[data-group="' + group + '"]')
        .forEach(function (other) {
          other.setAttribute("aria-pressed", other === chip ? "true" : "false");
        });
      apply();
    });
  });

  apply();
})();
"""


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def render(items: list[R.Item]) -> str:
    statuses = [s for s in R.STATUS_ORDER if any(i.status == s for i in items)]
    topics = sorted({i.topic_en for i in items})
    topic_ja = {i.topic_en: i.topic_ja for i in items}

    status_chips = [
        '<button class="chip" type="button" data-group="status" data-value="all" '
        f'aria-pressed="true">すべて<span class="n">{len(items)}</span></button>'
    ]
    for status in statuses:
        n = sum(1 for i in items if i.status == status)
        status_chips.append(
            '<button class="chip" type="button" data-group="status" '
            f'data-value="{esc(status)}" aria-pressed="false">'
            f'{esc(R.STATUS_JA[status])}<span class="n">{n}</span></button>'
        )

    topic_chips = [
        '<button class="chip" type="button" data-group="topic" data-value="all" '
        'aria-pressed="true">すべて</button>'
    ]
    for topic in topics:
        n = sum(1 for i in items if i.topic_en == topic)
        topic_chips.append(
            '<button class="chip" type="button" data-group="topic" '
            f'data-value="{esc(topic)}" aria-pressed="false">'
            f'<span data-ja="{esc(topic_ja[topic])}" data-en="{esc(topic)}">'
            f'{esc(topic_ja[topic])}</span><span class="n">{n}</span></button>'
        )

    rows = []
    for item in sorted(items, key=lambda i: i.number):
        rows.append(
            f'<li data-status="{esc(item.status)}" data-topic="{esc(item.topic_en)}">'
            '<article class="item">'
            f'<div class="id">{esc(item.id)}</div>'
            '<div class="body">'
            f'<h2><a class="title-link" href="{esc(item.url_ja)}" '
            f'data-href-ja="{esc(item.url_ja)}" data-href-en="{esc(item.url_en)}">'
            f'<span data-ja="{esc(item.title_ja)}" data-en="{esc(item.title_en)}">'
            f"{esc(item.title_ja)}</span></a></h2>"
            f'<p class="lede" data-ja="{esc(item.lede_ja)}" '
            f'data-en="{esc(item.lede_en)}">{esc(item.lede_ja)}</p>'
            '<div class="tags">'
            f'<span class="topic" data-ja="{esc(item.topic_ja)}" '
            f'data-en="{esc(item.topic_en)}">{esc(item.topic_ja)}</span>'
            f'<a href="{esc(item.url_ja)}">日本語</a>'
            f'<a href="{esc(item.url_en)}">English</a>'
            "</div></div>"
            f'<div class="status" data-status="{esc(item.status)}">'
            f'<span class="mark" aria-hidden="true">{R.STATUS_MARK[item.status]}</span>'
            f'<span data-ja="{esc(R.STATUS_JA[item.status])}" '
            f'data-en="{esc(item.status)}">{esc(R.STATUS_JA[item.status])}</span>'
            "</div></article></li>"
        )

    return f"""<!doctype html>
<html lang="ja" data-lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spectre UI ロードマップ</title>
<meta name="description" content="Spectre UI のロードマップ項目一覧。1項目1提案で、状態とトピックから絞り込める。">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="Spectre UI ロードマップ">
<meta property="og:description" content="ロードマップ項目の一覧。">
<meta property="og:type" content="website">
<style>{STYLE}</style>
</head>
<body data-lang="ja">
<header class="top">
  <div class="wrap">
    <h1>Spectre UI ロードマップ</h1>
    <p class="lede">
      サーバードリブンUI (SDUI) のためのクロスプラットフォームライブラリ。
      各項目は着手前に書かれた提案で、実装の有無は状態が示す。
    </p>
    <p class="meta">
      <span>設計フェーズ</span>
      <span><span id="count">{len(items)}</span> 件</span>
      <a href="{DOCS_PATH}">ドキュメント</a>
      <a href="{REPO_URL}">GitHub</a>
    </p>
  </div>
</header>

<div class="wrap">
  <div class="controls">
    <div class="row">
      <span class="label">状態</span>
      {"".join(status_chips)}
    </div>
    <div class="row">
      <span class="label">トピック</span>
      {"".join(topic_chips)}
    </div>
    <div class="row">
      <span class="label">言語</span>
      <button class="chip" type="button" data-group="lang" data-value="ja"
        aria-pressed="true">日本語</button>
      <button class="chip" type="button" data-group="lang" data-value="en"
        aria-pressed="false">English</button>
    </div>
  </div>

  <ol class="items" id="items">
    {"".join(rows)}
  </ol>
  <p class="empty" id="empty" hidden>該当する項目はありません。</p>
</div>

<footer class="bottom">
  <div class="wrap">
    <p>
      このページは <a href="{REPO_URL}/tree/main/roadmaps">roadmaps/</a> の各項目から生成している。
      項目の本文はリポジトリにあり、状態は各項目の <code>Status</code> が正となる。
    </p>
    <p>
      採番と記述の規約は
      <a href="{REPO_URL}/blob/main/roadmaps/README-ja.md">roadmaps/README-ja.md</a>、
      マイルストーンの全体像は
      <a href="{DOCS_PATH}roadmap/">ロードマップと未決事項</a>。
    </p>
  </div>
</footer>

<script>{SCRIPT}</script>
</body>
</html>
"""


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "site")
    items = R.load_items()
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(render(items), encoding="utf-8")
    counts = {s: sum(1 for i in items if i.status == s) for s in R.STATUS_ORDER}
    print(
        f"roadmap index: {len(items)} items -> {out_dir / 'index.html'}",
        json.dumps(counts, ensure_ascii=False),
    )


if __name__ == "__main__":
    main()
