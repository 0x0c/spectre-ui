"""ロードマップ項目一覧（サイトのトップ）を生成する。

`roadmaps/` の各項目から、カテゴリ（トピック）ごとにまとめたカード一覧を1枚作る。
項目の本文はリポジトリ（GitHub）に置いたままにし、ここでは**一覧に徹する**。

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
  --page: #f9f9f7;
  --card: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --ink-muted: #898781;
  --rule: #e1e0d9;
  --rule-strong: #c3c2b7;
  --accent: #1c5cab;
  --chip: #f2f1ed;
  /* メーター: 塗りと溝は同じ色相の別の段。濃淡だけで進捗を表す */
  --meter-fill: #2a78d6;
  --meter-track: #cde2fb;
  --good: #0ca30c;
  --warning: #a06a00;
  --sans: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP",
    "Yu Gothic UI", Meiryo, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #0d0d0d;
    --card: #1a1a19;
    --ink: #ffffff;
    --ink-2: #c3c2b7;
    --ink-muted: #898781;
    --rule: #2c2c2a;
    --rule-strong: #383835;
    --accent: #6da7ec;
    --chip: #232320;
    --meter-fill: #6da7ec;
    /* 暗い面では、溝は面に近い段にする。0% のときに満杯に見えないように */
    --meter-track: #104281;
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

.wrap { width: min(1080px, 100% - 44px); margin-inline: auto; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

/* ---------------------------------------------------------------- header */

header.top { padding: 68px 0 0; }

header.top h1 {
  font-size: 28px;
  font-weight: 640;
  letter-spacing: -0.02em;
  margin: 0;
}

header.top p.lede {
  margin: 10px 0 0;
  color: var(--ink-2);
  max-width: 60ch;
}

header.top .meta {
  margin-top: 16px;
  font-size: 13px;
  color: var(--ink-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
}

header.top .meta a { color: var(--ink-2); }
header.top .meta a:hover { color: var(--accent); }

/* -------------------------------------------------------------- overview */

.overview {
  margin-top: 28px;
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 720px) {
  .overview { grid-template-columns: 1fr; }
}

.panel {
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 18px 20px;
}

.panel .label {
  font-size: 12px;
  color: var(--ink-muted);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.panel .figure {
  font-size: 44px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 4px 0 2px;
}

.panel .figure .unit {
  font-size: 20px;
  font-weight: 600;
  color: var(--ink-2);
  margin-inline-start: 2px;
}

.panel .sub { font-size: 12.5px; color: var(--ink-2); line-height: 1.6; }

.status-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  align-items: flex-start;
  margin-top: 10px;
}

.status-counts .cell { min-width: 5.5rem; }

.status-counts .n {
  font-size: 26px;
  font-weight: 640;
  letter-spacing: -0.02em;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.status-counts .k {
  font-size: 12.5px;
  color: var(--ink-2);
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.status-counts .k .mark { font-size: 10px; }

/* メーター: 溝と塗りは同じ色相の別の段。値はインクの色で別に書く */
.meter {
  height: 6px;
  border-radius: 3px;
  background: var(--meter-track);
  overflow: hidden;
  margin-top: 8px;
}

.meter > span { display: block; height: 100%; background: var(--meter-fill); }

/* --------------------------------------------------------------- filters */

.controls {
  margin: 28px 0 6px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rule-strong);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 10px; }

.row .label {
  font-size: 12px;
  color: var(--ink-muted);
  min-width: 4em;
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
button.chip[aria-pressed="true"] { background: var(--ink); color: var(--page); }

button.chip .n {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
  margin-inline-start: 5px;
}

/* ------------------------------------------------------------ categories */

section.category { padding: 30px 0 4px; }
section.category.hidden { display: none; }

.category > h2 {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 640;
  letter-spacing: -0.01em;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.category > h2 .count {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.category > .cat-meter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.category > .cat-meter .meter { flex: 1; max-width: 300px; margin: 0; }

/* ----------------------------------------------------------------- cards */

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cards > li.hidden { display: none; }

/* カード表示とリスト表示で、同じ要素を並べ替えるだけにする */
.card {
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 18px 20px 16px;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto 1fr auto auto;
  grid-template-areas:
    "id     status"
    "title  title"
    "lede   lede"
    "prog   prog"
    "links  links";
  column-gap: 12px;
}

.card:hover { border-color: var(--rule-strong); }

.card .id {
  grid-area: id;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-muted);
  letter-spacing: 0.02em;
}

.card .status {
  grid-area: status;
  font-size: 12px;
  white-space: nowrap;
  color: var(--ink-2);
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  justify-self: end;
}

.card .status .mark { font-size: 10px; }
.card .status[data-status="Implemented"] { color: var(--good); }
.card .status[data-status="In progress"] { color: var(--warning); }
.card .status[data-status="Proposal (deferred)"] { color: var(--ink-muted); }

.card h3 {
  grid-area: title;
  margin: 6px 0 0;
  font-size: 16.5px;
  font-weight: 620;
  letter-spacing: -0.01em;
  line-height: 1.5;
}

.card h3 a { color: var(--ink); text-decoration: none; }
.card h3 a:hover { color: var(--accent); text-decoration: underline; }

/* 一覧の走査性を保つため4行で切る。全文は項目のリンク先にある。 */
.card p.lede {
  grid-area: lede;
  margin: 8px 0 0;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.75;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
}

.card .progress { grid-area: prog; padding-top: 16px; }

.card .progress .line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  color: var(--ink-muted);
}

.card .progress .line .value {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  font-weight: 600;
}

.card .links {
  grid-area: links;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
  display: flex;
  gap: 14px;
  font-size: 12.5px;
}

.card .links a { color: var(--ink-muted); }
.card .links a:hover { color: var(--accent); }

/* ------------------------------------------------------------ list view */

body[data-view="list"] .cards { display: block; }

body[data-view="list"] .cards > li + li { border-top: 1px solid var(--rule); }

body[data-view="list"] .card {
  background: none;
  border: 0;
  border-radius: 0;
  padding: 11px 4px;
  height: auto;
  grid-template-columns: 5.5rem minmax(0, 1fr) 170px 6.5rem;
  grid-template-rows: auto;
  grid-template-areas: "id title prog status";
  align-items: center;
  column-gap: 18px;
}

body[data-view="list"] .card h3 { margin: 0; font-size: 15px; }
body[data-view="list"] .card .status { justify-self: end; }
body[data-view="list"] .card p.lede,
body[data-view="list"] .card .links { display: none; }

body[data-view="list"] .card .progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 0;
}

body[data-view="list"] .card .progress .meter { order: 1; flex: 1; margin: 0; }
body[data-view="list"] .card .progress .line { order: 2; }
body[data-view="list"] .card .progress .line .k { display: none; }

@media (max-width: 760px) {
  body[data-view="list"] .card {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "id     status"
      "title  title"
      "prog   prog";
    align-items: baseline;
    padding: 14px 0;
  }
  body[data-view="list"] .card .progress { padding-top: 8px; }
}

/* ---------------------------------------------------------------- search */

.search {
  flex: 1;
  min-width: 200px;
  max-width: 420px;
  font: inherit;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--card);
  border: 1px solid var(--rule-strong);
  border-radius: 8px;
  padding: 5px 11px;
  -webkit-appearance: none;
  appearance: none;
}

.search::placeholder { color: var(--ink-muted); }
.search:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.empty { padding: 40px 0; color: var(--ink-muted); font-size: 14px; }

/* リンクを含む段落は差し替えではなく出し分けにする */
body[data-lang="ja"] .en-only { display: none; }
body[data-lang="en"] .ja-only { display: none; }

/* ---------------------------------------------------------------- footer */

footer.bottom {
  margin-top: 36px;
  border-top: 1px solid var(--rule);
  padding: 24px 0 72px;
  color: var(--ink-muted);
  font-size: 12.5px;
}

footer.bottom p { margin: 4px 0; }
footer.bottom a { color: var(--ink-muted); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
"""

SCRIPT = """
(function () {
  var state = { status: "all", topic: "all", lang: "ja", view: "card", q: "" };
  var cards = Array.prototype.slice.call(document.querySelectorAll(".cards > li"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("section.category"));
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");
  var search = document.getElementById("q");

  function apply() {
    document.documentElement.lang = state.lang;
    document.body.dataset.lang = state.lang;
    document.body.dataset.view = state.view;
    var shown = 0;

    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    cards.forEach(function (card) {
      var haystack = card.dataset.search;
      var ok =
        (state.status === "all" || card.dataset.status === state.status) &&
        (state.topic === "all" || card.dataset.topic === state.topic) &&
        terms.every(function (t) { return haystack.indexOf(t) !== -1; });
      card.classList.toggle("hidden", !ok);
      if (ok) shown++;
    });

    sections.forEach(function (section) {
      var visible = Array.prototype.slice.call(
        section.querySelectorAll(".cards > li:not(.hidden)")
      );
      section.classList.toggle("hidden", visible.length === 0);
      section.querySelector("h2 .count").textContent = visible.length;

      // 節のメーターは表示中の項目だけを数える
      var done = 0;
      var units = 0;
      visible.forEach(function (li) {
        done += Number(li.dataset.done);
        units += Number(li.dataset.units);
      });
      var meter = section.querySelector(".cat-meter .meter");
      meter.setAttribute("aria-label", done + " / " + units);
      meter.firstElementChild.style.width = units ? (done / units) * 100 + "%" : "0%";
      section.querySelector(".cat-meter .value").textContent = done + " / " + units;
    });

    count.textContent = shown;
    empty.hidden = shown !== 0;

    document.querySelectorAll("[data-ja]").forEach(function (el) {
      el.textContent = el.dataset[state.lang];
    });
    search.placeholder =
      state.lang === "ja" ? search.dataset.phJa : search.dataset.phEn;
    document.querySelectorAll("a.title-link").forEach(function (link) {
      link.href = state.lang === "ja" ? link.dataset.hrefJa : link.dataset.hrefEn;
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

  search.addEventListener("input", function () {
    state.q = search.value.trim();
    apply();
  });
  search.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && search.value) {
      search.value = "";
      state.q = "";
      apply();
    }
  });

  // 「/」で検索欄へ
  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
  });

  apply();
})();
"""


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def bilingual(ja: str, en: str, tag: str = "span", cls: str = "") -> str:
    """日本語を初期表示にし、英語を data 属性に持たせる。"""
    attr = f' class="{cls}"' if cls else ""
    return f'<{tag}{attr} data-ja="{esc(ja)}" data-en="{esc(en)}">{esc(ja)}</{tag}>'


def meter(done: int, total: int) -> str:
    percent = (done / total * 100) if total else 0
    return (
        '<div class="meter" role="img" '
        f'aria-label="{done} / {total}"><span style="width:{percent:.1f}%"></span></div>'
    )


def render(items: list[R.Item]) -> str:
    total_units = sum(i.units for i in items)
    total_done = sum(i.done for i in items)
    percent = round(total_done / total_units * 100) if total_units else 0
    estimated = any(i.units_estimated for i in items)

    statuses = [s for s in R.STATUS_ORDER if any(i.status == s for i in items)]

    # カテゴリはトピック。最小のID順に並べ、ロードマップの順序を保つ
    topics: dict[str, list[R.Item]] = {}
    for item in sorted(items, key=lambda i: i.number):
        topics.setdefault(item.topic_en, []).append(item)

    # -- 状態の内訳 ---------------------------------------------------------
    cells = []
    for status in statuses:
        n = sum(1 for i in items if i.status == status)
        cells.append(
            f'<div class="cell"><div class="n">{n}</div>'
            f'<div class="k" data-status="{esc(status)}">'
            f'<span class="mark" aria-hidden="true">{R.STATUS_MARK[status]}</span>'
            f"{bilingual(R.STATUS_JA[status], status)}</div></div>"
        )

    # -- 絞り込み -----------------------------------------------------------
    status_chips = [
        '<button class="chip" type="button" data-group="status" data-value="all" '
        f'aria-pressed="true">{bilingual("すべて", "All")}'
        f'<span class="n">{len(items)}</span></button>'
    ]
    for status in statuses:
        n = sum(1 for i in items if i.status == status)
        status_chips.append(
            '<button class="chip" type="button" data-group="status" '
            f'data-value="{esc(status)}" aria-pressed="false">'
            f'{bilingual(R.STATUS_JA[status], status)}<span class="n">{n}</span></button>'
        )

    topic_chips = [
        '<button class="chip" type="button" data-group="topic" data-value="all" '
        f'aria-pressed="true">{bilingual("すべて", "All")}</button>'
    ]
    for topic, group in topics.items():
        topic_chips.append(
            '<button class="chip" type="button" data-group="topic" '
            f'data-value="{esc(topic)}" aria-pressed="false">'
            f"{bilingual(group[0].topic_ja, topic)}"
            f'<span class="n">{len(group)}</span></button>'
        )

    # -- カテゴリごとのカード -----------------------------------------------
    sections = []
    for topic, group in topics.items():
        cards = []
        for item in group:
            haystack = " ".join(
                [
                    item.id,
                    item.title_ja,
                    item.title_en,
                    item.lede_ja,
                    item.lede_en,
                    item.topic_ja,
                    item.topic_en,
                    item.status,
                    R.STATUS_JA[item.status],
                ]
            ).lower()
            cards.append(
                f'<li data-status="{esc(item.status)}" data-topic="{esc(item.topic_en)}" '
                f'data-done="{item.done}" data-units="{item.units}" '
                f'data-search="{esc(haystack)}">'
                '<article class="card">'
                f'<span class="id">{esc(item.id)}</span>'
                f'<span class="status" data-status="{esc(item.status)}">'
                f'<span class="mark" aria-hidden="true">{R.STATUS_MARK[item.status]}</span>'
                f"{bilingual(R.STATUS_JA[item.status], item.status)}</span>"
                f'<h3><a class="title-link" href="{esc(item.url_ja)}" '
                f'data-href-ja="{esc(item.url_ja)}" data-href-en="{esc(item.url_en)}">'
                f"{bilingual(item.title_ja, item.title_en)}</a></h3>"
                f"{bilingual(item.lede_ja, item.lede_en, tag='p', cls='lede')}"
                '<div class="progress"><div class="line">'
                f'{bilingual("進捗", "Progress", cls="k")}'
                f'<span class="value">{item.done} / {item.units}</span></div>'
                f"{meter(item.done, item.units)}</div>"
                '<div class="links">'
                f'<a href="{esc(item.url_ja)}">日本語</a>'
                f'<a href="{esc(item.url_en)}">English</a>'
                "</div></article></li>"
            )

        units = sum(i.units for i in group)
        done = sum(i.done for i in group)
        sections.append(
            f'<section class="category" data-topic="{esc(topic)}">'
            f"<h2>{bilingual(group[0].topic_ja, topic)}"
            f'<span class="count">{len(group)}</span></h2>'
            '<div class="cat-meter">'
            f"{meter(done, units)}"
            f'<span class="value">{done} / {units}</span></div>'
            f'<ul class="cards">{"".join(cards)}</ul>'
            "</section>"
        )

    note_ja = (
        "進捗の分母は各項目の進捗チェックリスト。"
        "未着手の項目は、詳細設計の分解数を見込みとして使っている。"
        if estimated
        else "進捗の分母は各項目の進捗チェックリスト。"
    )
    note_en = (
        "Progress counts each item's progress checklist; for items not yet started, "
        "the detailed-design breakdown stands in for the denominator."
        if estimated
        else "Progress counts each item's progress checklist."
    )

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spectre UI ロードマップ</title>
<meta name="description" content="Spectre UI のロードマップ項目一覧。カテゴリごとにまとめ、状態と進捗を示す。">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="Spectre UI ロードマップ">
<meta property="og:description" content="ロードマップ項目の一覧。カテゴリごとに、状態と進捗つきで並べている。">
<meta property="og:type" content="website">
<style>{STYLE}</style>
</head>
<body data-lang="ja">
<header class="top">
  <div class="wrap">
    <h1>{bilingual("Spectre UI ロードマップ", "Spectre UI roadmap", tag="span")}</h1>
    {bilingual(
        "サーバードリブンUI (SDUI) のためのクロスプラットフォームライブラリ。"
        "各項目は着手前に書かれた提案で、実装の有無は状態が示す。",
        "A cross-platform library for server-driven user interfaces (SDUI). "
        "Each item is a proposal written before the work starts; its status says "
        "whether the code exists.",
        tag="p", cls="lede")}
    <p class="meta">
      {bilingual("設計フェーズ", "Design phase")}
      <span><span id="count">{len(items)}</span>
        {bilingual("件", "shown")}</span>
      <a href="{DOCS_PATH}">{bilingual("ドキュメント", "Documentation")}</a>
      <a href="{REPO_URL}">GitHub</a>
    </p>

    <div class="overview">
      <div class="panel">
        {bilingual("全体の進捗", "Overall progress", cls="label", tag="div")}
        <div class="figure">{percent}<span class="unit">%</span></div>
        <div class="sub">{total_done} / {total_units}
          {bilingual("作業単位", "work units")}</div>
        {meter(total_done, total_units)}
      </div>
      <div class="panel">
        {bilingual("状態の内訳", "By status", cls="label", tag="div")}
        <div class="status-counts">{"".join(cells)}</div>
      </div>
    </div>
  </div>
</header>

<div class="wrap">
  <div class="controls">
    <div class="row">
      {bilingual("状態", "Status", cls="label")}
      {"".join(status_chips)}
    </div>
    <div class="row">
      {bilingual("カテゴリ", "Category", cls="label")}
      {"".join(topic_chips)}
    </div>
    <div class="row">
      {bilingual("表示", "View", cls="label")}
      <button class="chip" type="button" data-group="view" data-value="card"
        aria-pressed="true">{bilingual("カード", "Cards")}</button>
      <button class="chip" type="button" data-group="view" data-value="list"
        aria-pressed="false">{bilingual("リスト", "List")}</button>
      {bilingual("言語", "Language", cls="label")}
      <button class="chip" type="button" data-group="lang" data-value="ja"
        aria-pressed="true">日本語</button>
      <button class="chip" type="button" data-group="lang" data-value="en"
        aria-pressed="false">English</button>
    </div>
    <div class="row">
      {bilingual("検索", "Search", cls="label")}
      <input class="search" id="q" type="search" autocomplete="off"
        aria-label="{esc("ロードマップ項目を検索")}"
        data-ph-ja="{esc("ID・タイトル・本文で絞り込む（/ で移動）")}"
        data-ph-en="{esc("Filter by ID, title, or text (press /)")}"
        placeholder="{esc("ID・タイトル・本文で絞り込む（/ で移動）")}">
    </div>
  </div>

  {"".join(sections)}
  {bilingual("該当する項目はありません。", "No items match.", tag="p", cls="empty")
     .replace('class="empty"', 'class="empty" id="empty" hidden')}
</div>

<footer class="bottom">
  <div class="wrap">
    <p>{bilingual(note_ja, note_en)}</p>
    <p class="ja-only">
      このページは <a href="{REPO_URL}/tree/main/roadmaps">roadmaps/</a> の各項目から生成している。
      項目の本文はリポジトリにあり、状態は各項目の Status が正となる。
    </p>
    <p class="en-only">
      This page is generated from the items under
      <a href="{REPO_URL}/tree/main/roadmaps">roadmaps/</a>. The item bodies live in the
      repository, and each item's Status is the single source of truth.
    </p>
    <p class="ja-only">
      採番と記述の規約は
      <a href="{REPO_URL}/blob/main/roadmaps/README-ja.md">roadmaps/README-ja.md</a>、
      マイルストーンの全体像は
      <a href="{DOCS_PATH}roadmap/">ロードマップと未決事項</a>。
    </p>
    <p class="en-only">
      Numbering and writing rules:
      <a href="{REPO_URL}/blob/main/roadmaps/README.md">roadmaps/README.md</a>.
      Milestone overview:
      <a href="{DOCS_PATH}roadmap/">ロードマップと未決事項</a> (Japanese).
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
        f"roadmap index: {len(items)} items, "
        f"{sum(i.done for i in items)}/{sum(i.units for i in items)} units "
        f"-> {out_dir / 'index.html'}",
        json.dumps(counts, ensure_ascii=False),
    )


if __name__ == "__main__":
    main()
