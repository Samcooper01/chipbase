/* Games: what happens if. A situation is described with the numbers it starts
   from, and three or four things somebody might actually try. You pick one,
   and every option's measured outcome is revealed: yours, the best one, and
   the rest.

   The right answer is never authored. Each item declares an objective, such
   as the smallest period or the least area, and the winner is computed from
   the measurements. If the content is edited so that another option becomes
   best, the grading follows it.

   window.WhatIf = { mount, winner, buildRound }. */
(function () {
  "use strict";
  var ROUND_SIZE = 5;

  function better(a, b, key, dir) {          // is a better than b on this metric?
    var av = a.outcome[key], bv = b.outcome[key];
    if (av === undefined || av === null) return false;
    if (bv === undefined || bv === null) return true;
    return dir === "max" ? av > bv : av < bv;
  }
  function same(a, b, key) { return a.outcome[key] === b.outcome[key]; }
  function winner(item) {
    /* the objective decides, and where two runs tie on it the tiebreak does.
       Content with a tie and no tiebreak would make the answer arbitrary, so
       the loader refuses it rather than picking one. */
    var obj = item.objective, tie = obj.tiebreak;
    var best = null;
    item.options.forEach(function (o) {
      if (best === null) { best = o; return; }
      if (better(o, best, obj.metric, obj.direction || "min")) { best = o; return; }
      if (tie && same(o, best, obj.metric) && better(o, best, tie.metric, tie.direction || "min")) best = o;
    });
    return best ? best.id : null;
  }
  function buildRound(items, progress, size, rng) {
    size = size || ROUND_SIZE;
    var fresh = [], wrong = [], rest = [];
    items.forEach(function (it) {
      var p = progress[it.id];
      if (!p) fresh.push(it); else if (!p.right) wrong.push(it); else rest.push(it);
    });
    return shuffled(fresh, rng).concat(shuffled(wrong, rng), shuffled(rest, rng))
      .slice(0, size).map(function (it) { return it.id; });
  }
  function shuffled(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function rich(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }

  function mount(root, data, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, clock = opts.now || function () { return Date.now(); };
    var KEY = "pdleet-wi-" + data.game;
    var byId = {}; data.items.forEach(function (it) { byId[it.id] = it; });
    function load() {
      try { var raw = window.localStorage.getItem(KEY); var p = raw ? JSON.parse(raw) : {}; return p && typeof p === "object" ? p : {}; }
      catch (e) { return {}; }
    }
    function save() { try { window.localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} }
    var progress = load();

    var queue = [], cur = null, answered = false, roundLen = 0, done = 0, right = 0;
    var box = document.createElement("div"); root.appendChild(box);
    var statusEl = document.createElement("div"); statusEl.className = "fc-status"; root.appendChild(statusEl);

    function renderStatus() {
      var seen = 0, ok = 0;
      data.items.forEach(function (it) { var p = progress[it.id]; if (p) { seen++; if (p.right) ok++; } });
      statusEl.innerHTML = '<span><b>' + data.items.length + '</b> situations</span><span><b>' + seen + '</b> seen</span>' +
        '<span><b>' + (seen ? Math.round((100 * ok) / seen) : 0) + '%</b> called right</span>' +
        '<button type="button" class="fc-linkbtn" data-act="reset-progress">reset progress</button>';
    }
    function startRound() {
      queue = buildRound(data.items, progress, ROUND_SIZE, rng);
      roundLen = queue.length; done = 0; right = 0;
      if (!queue.length) { box.innerHTML = '<div class="fc-card">Nothing to show.</div>'; return; }
      next();
    }
    function next() {
      if (!queue.length) { renderSummary(); return; }
      cur = byId[queue.shift()]; answered = false;
      var start = (cur.start || []).map(function (f) {
        return '<div class="ou-fact"><dt>' + esc(f.label) + '</dt><dd>' + esc(f.value) + '</dd></div>';
      }).join("");
      var html = '<div class="fc-card wi-card" data-item="' + esc(cur.id) + '">' +
        '<div class="fc-meta"><span class="chip fc-topic">' + esc(cur.topic || "") + '</span>' +
        '<span class="fc-count">situation ' + (done + 1) + ' of ' + roundLen + '</span></div>' +
        '<p class="wi-situation">' + rich(cur.situation) + '</p>' +
        '<dl class="ou-facts">' + start + '</dl>' +
        '<div class="fc-question">' + esc(cur.question) + '</div>' +
        '<div class="wi-options">';
      shuffled(cur.options, rng).forEach(function (o) {
        html += '<button type="button" class="wi-option" data-choice="' + esc(o.id) + '">' +
          '<b>' + esc(o.label) + '</b>' + (o.detail ? '<span>' + esc(o.detail) + '</span>' : "") + '</button>';
      });
      html += '</div><div class="fc-feedback"></div></div>';
      box.innerHTML = html;
      renderStatus();
    }
    function table(item, chosen, best) {
      var cols = item.metrics || [];
      var head = '<tr><th>what was tried</th>' + cols.map(function (c) {
        return '<th>' + esc(c.label) + (c.unit ? ' <span class="wi-unit">' + esc(c.unit) + '</span>' : "") + '</th>';
      }).join("") + '</tr>';
      var rows = item.options.map(function (o) {
        var cls = (o.id === best ? " is-best" : "") + (o.id === chosen ? " is-yours" : "");
        return '<tr class="wi-row' + cls + '"><td>' + esc(o.label) +
          (o.id === chosen ? ' <span class="wi-tag">your pick</span>' : "") +
          (o.id === best ? ' <span class="wi-tag is-best">best</span>' : "") + '</td>' +
          cols.map(function (c) {
            var v = o.outcome[c.key];
            return "<td>" + (v === undefined || v === null ? "not measured" : esc(v)) + "</td>";
          }).join("") + '</tr>';
      }).join("");
      return '<table class="wi-table">' + head + rows + '</table>';
    }
    function answer(choice) {
      if (answered || !cur) return;
      answered = true;
      var best = winner(cur), ok = choice === best;
      progress[cur.id] = { right: ok, at: clock() }; save();
      done++; if (ok) right++;
      var btns = box.querySelectorAll(".wi-option");
      for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
        var c = btns[i].getAttribute("data-choice");
        if (c === best) btns[i].classList.add("fc-right");
        else if (c === choice) btns[i].classList.add("fc-wrong");
      }
      box.querySelector(".fc-feedback").innerHTML =
        '<div class="fc-verdict ' + (ok ? "fc-v-ok" : "fc-v-bad") + '">' +
        (ok ? "That is what the runs say." : "The runs say otherwise.") + '</div>' +
        table(cur, choice, best) +
        '<p class="fc-explain">' + rich(cur.explain || "") + '</p>' +
        (cur.caveat ? '<p class="wi-caveat">' + rich(cur.caveat) + '</p>' : "") +
        '<div class="fc-actions"><button type="button" class="btn fc-next" data-act="next">Next situation</button>' +
        '<span class="fc-source">runs: ' + esc(cur.source) + '</span></div>';
      renderStatus();
    }
    function renderSummary() {
      box.innerHTML = '<div class="fc-card"><div class="fc-idle-title">Round complete: ' + right + ' of ' + roundLen + ' called right.</div>' +
        '<div class="fc-actions"><button type="button" class="btn" data-act="start">Another round</button></div></div>';
      cur = null; renderStatus();
    }
    function onClick(e) {
      var t = e.target;
      while (t && t !== root && !(t.getAttribute && (t.getAttribute("data-choice") || t.getAttribute("data-act")))) t = t.parentNode;
      if (!t || t === root) return;
      var choice = t.getAttribute("data-choice"), act = t.getAttribute("data-act");
      if (choice) answer(choice);
      else if (act === "next") next();
      else if (act === "start") startRound();
      else if (act === "reset-progress") {
        if (!opts.confirm || opts.confirm("Reset all progress for this drill?")) { progress = {}; save(); startRound(); }
      }
    }
    root.addEventListener("click", onClick);
    startRound();
    return { answer: answer, next: next };
  }

  var api = { mount: mount, winner: winner, buildRound: buildRound };
  if (typeof window !== "undefined") window.WhatIf = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
