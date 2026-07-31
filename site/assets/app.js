/* Spectre UI — roadmap homepage
 * No dependencies. Renders every section from window.ROADMAP.
 */
(function () {
  "use strict";

  var DATA = window.ROADMAP;
  var SVGNS = "http://www.w3.org/2000/svg";
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  /* ---------------------------------------------------------------- utils */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function msColor(i) {
    return "var(--m" + i + ")";
  }

  function taskTotals(m) {
    var done = m.tasks.filter(function (t) {
      return t.done;
    }).length;
    return { done: done, total: m.tasks.length };
  }

  var IMPACT = {
    大: { cls: "lv-large", icon: "critical" },
    中: { cls: "lv-medium", icon: "warning" },
    小: { cls: "lv-small", icon: "info" },
  };

  var ICONS = {
    critical:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8 15 14H1L8 1.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6v3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.6" r=".9" fill="currentColor"/></svg>',
    warning:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.6V8.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.1" r=".9" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="4.9" r=".9" fill="currentColor"/></svg>',
    check:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8.4 3.2 3.2L13 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9m0 0-3.4-3.4M12 8l-3.4 3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    doc: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9 1.8H4.4A1.4 1.4 0 0 0 3 3.2v9.6a1.4 1.4 0 0 0 1.4 1.4h7.2a1.4 1.4 0 0 0 1.4-1.4V6L9 1.8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 1.8V6h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  };

  function impactBadge(level) {
    var m = IMPACT[level] || IMPACT["小"];
    return (
      '<span class="impact ' +
      m.cls +
      '">' +
      ICONS[m.icon] +
      "影響 " +
      esc(level) +
      "</span>"
    );
  }

  /* ------------------------------------------------------------ schedule */

  /**
   * 週単位のスケジュールを組む。
   *  mode "parallel" : docs/roadmap.md の担当者前提（iOS/Android と Web/サーバ が別）に
   *                    従い、M1 と M2 を並行させる。
   *  mode "serial"   : 全マイルストーンを直列に積む。
   * 各マイルストーンは最短 (min) と最長 (max) の 2 本のシナリオを持つ。
   */
  function schedule(mode) {
    var ends = {}; // track -> {min, max}
    var out = {};
    DATA.milestones.forEach(function (m) {
      // M0 は全トラックの前提。並行時は client/web ともに M0 の完了を起点にする。
      var prev;
      if (mode === "serial") {
        prev = ends.all || { min: 0, max: 0 };
      } else if (m.track === "spec") {
        prev = { min: 0, max: 0 };
      } else {
        prev = ends[m.track] || ends.all || { min: 0, max: 0 };
      }
      var lo = m.weeks[0],
        hi = m.weeks[1];
      var s = {
        id: m.id,
        startMin: prev.min,
        startMax: prev.max,
        endMin: m.ongoing ? prev.min : prev.min + lo,
        endMax: m.ongoing ? null : prev.max + hi,
        ongoing: !!m.ongoing,
      };
      out[m.id] = s;
      if (!m.ongoing) {
        var e = { min: s.endMin, max: s.endMax };
        if (mode === "serial" || m.track === "spec") {
          ends.all = e;
          ends.client = e;
          ends.web = e;
        } else {
          ends[m.track] = e;
        }
      }
    });
    return out;
  }

  function releaseRange(sch) {
    var m3 = sch.M3;
    return { min: m3.endMin, max: m3.endMax };
  }

  /* --------------------------------------------------------------- hero */

  function renderHero() {
    var p = DATA.project;
    $("#hero-tagline").textContent = p.tagline;
    $("#hero-phase").textContent = p.phase;
    $("#assumption").textContent = p.assumption;

    var total = 0,
      done = 0;
    DATA.milestones.forEach(function (m) {
      var t = taskTotals(m);
      total += t.total;
      done += t.done;
    });
    var open = DATA.openQuestions.length;
    var bigRisks = DATA.risks.filter(function (r) {
      return r.impact === "大";
    }).length;

    $("#stat-tasks").innerHTML =
      done + " <span class='unit'>/ " + total + "</span>";
    $("#stat-tasks-sub").textContent =
      "5 マイルストーンの成果物。設計フェーズのため着手前。";
    $("#stat-open").innerHTML = open + " <span class='unit'>件</span>";
    $("#stat-open-sub").textContent =
      "うち 2 件は設計への影響が「大」。M0 着手前に確認が要る。";
    $("#stat-risk").innerHTML = bigRisks + " <span class='unit'>/ " + DATA.risks.length + "</span>";
    $("#stat-risk-sub").textContent = "影響「大」のリスク。すべて対策を割り当て済み。";
  }

  function updateHeroFigure(mode) {
    var r = releaseRange(schedule(mode));
    $("#hero-weeks").innerHTML =
      r.min + "–" + r.max + " <span class='unit'>週</span>";
    $("#hero-weeks-sub").textContent =
      "M0 着手から M3（配信基盤）完了 = 本番投入可能まで。" +
      (mode === "parallel" ? "M1 と M2 を並行させた場合。" : "全マイルストーンを直列に積んだ場合。");
  }

  /* ---------------------------------------------------------- flow chart */

  function renderFlow() {
    var byId = {};
    DATA.milestones.forEach(function (m, i) {
      m._i = i;
      byId[m.id] = m;
    });

    function node(m) {
      var t = taskTotals(m);
      var weeks = m.ongoing ? "継続" : m.weeks[0] + "–" + m.weeks[1] + "週";
      return (
        '<a class="flow-node" href="#' +
        m.id +
        '" style="--node:' +
        msColor(m._i) +
        '">' +
        '<div class="id">' +
        m.id +
        "</div>" +
        '<div class="name">' +
        esc(m.title) +
        "</div>" +
        '<div class="meta">' +
        weeks +
        " · " +
        t.total +
        "項目 · " +
        esc(m.trackLabel) +
        "</div>" +
        "</a>"
      );
    }

    var arrow = '<div class="flow-arrow">' + ICONS.arrow + "</div>";
    $("#flow").innerHTML =
      '<div class="flow-col">' +
      node(byId.M0) +
      "</div>" +
      arrow +
      '<div class="flow-col">' +
      node(byId.M1) +
      node(byId.M2) +
      "</div>" +
      arrow +
      '<div class="flow-col">' +
      node(byId.M3) +
      "</div>" +
      arrow +
      '<div class="flow-col">' +
      node(byId.M4) +
      "</div>";
  }

  /* -------------------------------------------------------------- gantt */

  var TIP = null;

  function tipShow(html, evt) {
    if (!TIP) return;
    TIP.innerHTML = html;
    TIP.setAttribute("data-open", "true");
    tipMove(evt);
  }

  function tipMove(evt) {
    if (!TIP) return;
    var pad = 14;
    var r = TIP.getBoundingClientRect();
    var x = evt.clientX + pad;
    var y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    TIP.style.left = Math.max(8, x) + "px";
    TIP.style.top = Math.max(8, y) + "px";
  }

  function tipHide() {
    if (TIP) TIP.setAttribute("data-open", "false");
  }

  var ganttMode = "parallel";

  function renderGantt() {
    var sch = schedule(ganttMode);
    var host = $("#gantt");
    host.innerHTML = "";

    var LABEL_W = 132;
    var PAD_R = 74;
    var ROW_H = 46;
    var BAR_H = 22;
    var TOP = 26; // 本番投入可能ラベルのための余白
    var AXIS_H = 38;
    var W = 900;
    var rows = DATA.milestones.length;
    var H = TOP + rows * ROW_H + AXIS_H;

    var maxEnd = 0;
    DATA.milestones.forEach(function (m) {
      var s = sch[m.id];
      if (s.endMax != null) maxEnd = Math.max(maxEnd, s.endMax);
    });
    var axisMax = Math.ceil((maxEnd + 5) / 4) * 4;
    var plotW = W - LABEL_W - PAD_R;
    var x = function (w) {
      return LABEL_W + (w / axisMax) * plotW;
    };

    var root = svg("svg", {
      class: "chart-svg",
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label":
        "マイルストーンのタイムライン。横軸は M0 着手からの週数。" +
        (ganttMode === "parallel" ? "M1 と M2 は並行。" : "全マイルストーンは直列。"),
    });

    /* gridlines + x ticks */
    for (var w = 0; w <= axisMax; w += 4) {
      root.appendChild(
        svg("line", {
          class: w === 0 ? "axis-line" : "grid-line",
          x1: x(w),
          x2: x(w),
          y1: TOP,
          y2: TOP + rows * ROW_H,
        })
      );
      root.appendChild(
        svg(
          "text",
          {
            class: "tick-text",
            x: x(w),
            y: TOP + rows * ROW_H + 18,
            "text-anchor": "middle",
          },
          w === 0 ? "0" : w + ""
        )
      );
    }
    root.appendChild(
      svg(
        "text",
        {
          class: "tick-text",
          x: LABEL_W,
          y: TOP + rows * ROW_H + 33,
          "text-anchor": "start",
        },
        "M0 着手からの週数"
      )
    );

    /* bars */
    DATA.milestones.forEach(function (m, i) {
      var s = sch[m.id];
      var cy = TOP + i * ROW_H + ROW_H / 2;
      var by = cy - BAR_H / 2;
      var color = msColor(i);
      var t = taskTotals(m);

      var g = svg("g", { class: "bar-row", tabindex: "0", role: "group" });

      g.appendChild(
        svg(
          "text",
          { class: "row-label", x: 0, y: cy - 2, "dominant-baseline": "middle" },
          m.id + " " + m.title
        )
      );
      g.appendChild(
        svg(
          "text",
          { class: "row-sub", x: 0, y: cy + 13, "dominant-baseline": "middle" },
          m.trackLabel + " · " + t.total + "項目"
        )
      );

      var bandX = x(s.startMin);
      var bandEnd = s.ongoing ? x(axisMax) : x(s.endMax);
      var solidEnd = s.ongoing ? bandX : x(s.endMin);

      if (!s.ongoing) {
        /* 振れ幅（最長ケースまで） */
        g.appendChild(
          svg("rect", {
            x: bandX,
            y: by,
            width: Math.max(2, bandEnd - bandX),
            height: BAR_H,
            rx: 4,
            fill: color,
            "fill-opacity": 0.16,
          })
        );
        /* 最短ケース */
        g.appendChild(
          svg("rect", {
            x: bandX,
            y: by,
            width: Math.max(3, solidEnd - bandX),
            height: BAR_H,
            rx: 4,
            fill: color,
          })
        );
      } else {
        g.appendChild(
          svg("path", {
            d:
              "M" +
              bandX +
              " " +
              by +
              "h" +
              (bandEnd - bandX - 14) +
              "l14 " +
              BAR_H / 2 +
              "l-14 " +
              BAR_H / 2 +
              "H" +
              bandX +
              "Z",
            fill: color,
            "fill-opacity": 0.28,
          })
        );
      }

      /* direct label at the bar end */
      var label = s.ongoing
        ? "継続"
        : m.weeks[0] + "–" + m.weeks[1] + "週";
      g.appendChild(
        svg(
          "text",
          {
            class: "value-label",
            x: bandEnd + 8,
            y: cy,
            "dominant-baseline": "middle",
          },
          label
        )
      );

      /* hover / focus target — full row band */
      var hit = svg("rect", {
        class: "hit",
        x: LABEL_W - 6,
        y: cy - ROW_H / 2,
        width: W - LABEL_W + 6,
        height: ROW_H,
      });
      g.appendChild(hit);

      var tipHTML =
        '<div class="t-title"><span class="t-swatch" style="background:' +
        color +
        '"></span>' +
        m.id +
        " " +
        esc(m.title) +
        "</div><dl>" +
        "<dt>期間</dt><dd>" +
        (s.ongoing ? "継続（見積もりなし）" : m.weeks[0] + "–" + m.weeks[1] + " 週") +
        "</dd>" +
        "<dt>開始</dt><dd>" +
        (s.startMin === s.startMax ? s.startMin : s.startMin + "–" + s.startMax) +
        " 週目</dd>" +
        (s.ongoing
          ? ""
          : "<dt>完了</dt><dd>" + s.endMin + "–" + s.endMax + " 週目</dd>") +
        "<dt>担当</dt><dd>" +
        esc(m.trackLabel) +
        "</dd>" +
        "<dt>成果物</dt><dd>" +
        t.done +
        " / " +
        t.total +
        " 完了</dd>" +
        "</dl>";

      g.addEventListener("pointerenter", function (e) {
        tipShow(tipHTML, e);
        dim(i, true);
      });
      g.addEventListener("pointermove", tipMove);
      g.addEventListener("pointerleave", function () {
        tipHide();
        dim(i, false);
      });
      g.addEventListener("focus", function () {
        var r = hit.getBoundingClientRect();
        tipShow(tipHTML, { clientX: r.left + 40, clientY: r.top + r.height });
        dim(i, true);
      });
      g.addEventListener("blur", function () {
        tipHide();
        dim(i, false);
      });

      root.appendChild(g);
    });

    function dim(active, on) {
      var groups = root.querySelectorAll("g.bar-row");
      for (var i = 0; i < groups.length; i++) {
        groups[i].classList.toggle("dim", on && i !== active);
      }
    }

    /* 本番投入可能マーカー（M3 の最短完了） */
    var rel = releaseRange(sch);
    var rx = x(rel.min);
    root.appendChild(
      svg("line", { class: "release-line", x1: rx, x2: rx, y1: TOP - 14, y2: TOP + rows * ROW_H })
    );
    root.appendChild(
      svg(
        "text",
        { class: "release-text", x: rx + 6, y: TOP - 8 },
        "本番投入可能（最短 " + rel.min + " 週）"
      )
    );

    host.appendChild(root);
    renderGanttTable(sch);
    $("#gantt-caption").textContent =
      ganttMode === "parallel"
        ? "M1（iOS/Android）と M2（エディタ）を並行させた場合。担当者が分かれている前提に沿う。"
        : "1チームが全マイルストーンを直列に進めた場合の上限見積もり。";
  }

  function renderGanttTable(sch) {
    var rows = DATA.milestones
      .map(function (m) {
        var s = sch[m.id];
        var t = taskTotals(m);
        return (
          "<tr><th scope='row'>" +
          m.id +
          " " +
          esc(m.title) +
          "</th>" +
          "<td>" +
          esc(m.trackLabel) +
          "</td>" +
          "<td class='num'>" +
          (m.ongoing ? "継続" : m.weeks[0] + "–" + m.weeks[1]) +
          "</td>" +
          "<td class='num'>" +
          (s.startMin === s.startMax ? s.startMin : s.startMin + "–" + s.startMax) +
          "</td>" +
          "<td class='num'>" +
          (s.ongoing ? "—" : s.endMin + "–" + s.endMax) +
          "</td>" +
          "<td class='num'>" +
          t.done +
          " / " +
          t.total +
          "</td></tr>"
        );
      })
      .join("");
    $("#gantt-table").innerHTML =
      "<table class='data'><thead><tr>" +
      "<th scope='col'>マイルストーン</th><th scope='col'>担当</th><th scope='col'>期間（週）</th>" +
      "<th scope='col'>開始（週目）</th><th scope='col'>完了（週目）</th><th scope='col'>成果物</th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table>";
  }

  /* ---------------------------------------------------------- milestones */

  function renderMilestones() {
    $("#milestones").innerHTML = DATA.milestones
      .map(function (m, i) {
        var t = taskTotals(m);
        var pct = t.total ? (t.done / t.total) * 100 : 0;
        var tasks = m.tasks
          .map(function (task) {
            return (
              "<li class='" +
              (task.done ? "done " : "") +
              (task.critical ? "critical" : "") +
              "'><span class='box'></span><span>" +
              esc(task.t) +
              (task.critical ? "<span class='tag-critical'>必須・後回し不可</span>" : "") +
              "</span></li>"
            );
          })
          .join("");

        return (
          "<article class='ms-card' id='" +
          m.id +
          "' style='--node:" +
          msColor(i) +
          "'>" +
          "<header><span class='ms-badge'>" +
          m.id +
          "</span><h3>" +
          esc(m.title) +
          "</h3><span class='weeks'>" +
          (m.ongoing ? "継続" : m.weeks[0] + "–" + m.weeks[1] + " 週") +
          "</span></header>" +
          "<p class='goal'>" +
          esc(m.goal) +
          "</p>" +
          "<div class='ms-meter'><div class='row'><span>成果物の進捗</span><span class='count'>" +
          t.done +
          " / " +
          t.total +
          "</span></div>" +
          "<div class='meter-track'><div class='meter-fill' style='width:" +
          pct +
          "%'></div></div></div>" +
          "<ul class='task-list'>" +
          tasks +
          "</ul>" +
          (m.acceptance
            ? "<div class='acceptance'><strong>" +
              ICONS.check +
              "受け入れ基準</strong>" +
              esc(m.acceptance) +
              "</div>"
            : "") +
          "<p class='doc-link'><a href='" +
          m.doc +
          "'>関連ドキュメントを読む →</a></p>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ----------------------------------------------------- open questions */

  function renderQuestions() {
    $("#questions").innerHTML = DATA.openQuestions
      .map(function (q) {
        return (
          "<article class='q-item'>" +
          "<div class='n'>" +
          q.n +
          "</div>" +
          "<div class='q-head'><h3>" +
          esc(q.title) +
          "</h3>" +
          impactBadge(q.impact) +
          "</div>" +
          "<ul>" +
          q.points
            .map(function (p) {
              return "<li>" + esc(p) + "</li>";
            })
            .join("") +
          "</ul></article>"
        );
      })
      .join("");
  }

  /* -------------------------------------------------------------- risks */

  function renderRisks() {
    var rows = DATA.risks
      .map(function (r) {
        return (
          "<tr><td>" +
          esc(r.risk) +
          "</td><td>" +
          impactBadge(r.impact) +
          "</td><td>" +
          esc(r.mitigation) +
          "</td></tr>"
        );
      })
      .join("");
    $("#risks").innerHTML =
      "<table class='data risk-table'><thead><tr><th scope='col'>リスク</th>" +
      "<th scope='col'>影響</th><th scope='col'>対策</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>";
  }

  /* ------------------------------------------------------ actions/stack */

  function renderActionsAndStack() {
    $("#actions").innerHTML = DATA.nextActions
      .map(function (a) {
        return "<li>" + esc(a) + "</li>";
      })
      .join("");

    $("#stack").innerHTML =
      "<table class='data'><thead><tr><th scope='col'>領域</th><th scope='col'>採用技術</th></tr></thead><tbody>" +
      DATA.stack
        .map(function (s) {
          return "<tr><th scope='row'>" + esc(s.area) + "</th><td>" + esc(s.tech) + "</td></tr>";
        })
        .join("") +
      "</tbody></table>";
  }

  /* --------------------------------------------------------------- docs */

  function renderDocs() {
    var base = DATA.project.repo + "/blob/main/";
    $("#docs").innerHTML = DATA.docs
      .map(function (d) {
        return (
          "<a class='doc-card' href='" +
          base +
          d.path +
          "'><div class='t'>" +
          ICONS.doc +
          esc(d.title) +
          "</div><div class='d'>" +
          esc(d.desc) +
          "</div><div class='p'>" +
          esc(d.path) +
          "</div></a>"
        );
      })
      .join("");
  }

  /* -------------------------------------------------------------- chrome */

  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("spectre-theme");
    } catch (e) {
      /* private mode */
    }
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    $("#theme-toggle").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      if (!cur) {
        cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("spectre-theme", next);
      } catch (e) {
        /* ignore */
      }
    });
  }

  function initTableToggles() {
    Array.prototype.forEach.call(document.querySelectorAll(".table-toggle"), function (btn) {
      var target = document.getElementById(btn.getAttribute("aria-controls"));
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        target.hidden = open;
        btn.querySelector("span").textContent = open ? "テーブルで見る" : "テーブルを閉じる";
      });
    });
  }

  function initGanttToggle() {
    Array.prototype.forEach.call(document.querySelectorAll("#gantt-mode button"), function (b) {
      b.addEventListener("click", function () {
        ganttMode = b.getAttribute("data-mode");
        Array.prototype.forEach.call(document.querySelectorAll("#gantt-mode button"), function (o) {
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        renderGantt();
        updateHeroFigure(ganttMode);
      });
    });
  }

  /* --------------------------------------------------------------- boot */

  function boot() {
    TIP = $("#tooltip");
    renderHero();
    updateHeroFigure(ganttMode);
    renderFlow();
    renderGantt();
    renderMilestones();
    renderQuestions();
    renderRisks();
    renderActionsAndStack();
    renderDocs();
    initTheme();
    initTableToggles();
    initGanttToggle();
    $("#year").textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
