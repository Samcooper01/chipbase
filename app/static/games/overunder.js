/* Games: over / under. A design summary is shown with a question about one of
   its metrics, and the player says whether the real value lands over or under
   a stated threshold. The value is then revealed on a scale against that
   threshold, so a wrong guess still shows how wrong.

   Progress lives in the browser (localStorage), one record per set:
   { itemId: { right: true|false, at: epoch ms } }. A round prefers items not
   seen yet, then the ones answered wrongly, then the rest.

   The scoring here is deliberately plain: right or wrong. A confidence level
   per answer, scored properly, is the natural next layer and is why `answer`
   and the rendering are kept apart.

   window.OverUnder = { mount, buildRound, direction }. */
(function () {
  "use strict";
  var ROUND_SIZE = 8;

  function direction(item) { return item.value > item.threshold ? "over" : "under"; }

  function buildRound(items, progress, size, rng) {
    size = size || ROUND_SIZE;
    var fresh = [], wrong = [], rest = [];
    items.forEach(function (it) {
      var p = progress[it.id];
      if (!p) fresh.push(it);
      else if (!p.right) wrong.push(it);
      else rest.push(it);
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
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  function mount(root, data, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, clock = opts.now || function () { return Date.now(); };
    var KEY = "pdleet-ou-" + data.game;
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
      statusEl.innerHTML = '<span><b>' + data.items.length + '</b> summaries</span>' +
        '<span><b>' + seen + '</b> answered</span>' +
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
      var d = cur.design || {}, facts = "";
      [["design", d.name], ["platform", d.platform], ["clock", d.clock], ["size", d.size]].forEach(function (row) {
        if (row[1]) facts += '<div class="ou-fact"><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>';
      });
      box.innerHTML = '<div class="fc-card ou-card" data-item="' + esc(cur.id) + '">' +
        '<div class="fc-meta"><span class="chip fc-topic">' + esc(cur.topic || "") + '</span>' +
        '<span class="fc-count">summary ' + (done + 1) + ' of ' + roundLen + '</span></div>' +
        '<dl class="ou-facts">' + facts + '</dl>' +
        (d.note ? '<p class="ou-note">' + rich(d.note) + '</p>' : "") +
        '<div class="fc-question">' + esc(cur.question) + '</div>' +
        (cur.hint ? '<div class="fc-hint-row"><button type="button" class="fc-hintbtn" data-act="hint">Show a hint</button><span class="fc-hint"></span></div>' : "") +
        '<div class="ou-choices">' +
        '<button type="button" class="ou-choice" data-call="under"><b>under</b><span>below ' + esc(num(cur.threshold)) + '</span></button>' +
        '<button type="button" class="ou-choice" data-call="over"><b>over</b><span>above ' + esc(num(cur.threshold)) + '</span></button>' +
        '</div><div class="fc-feedback"></div></div>';
      renderStatus();
    }
    function scale(item) {
      /* the threshold sits at the middle, and the value is placed against it,
         pinned to the end when it is more than twice the threshold */
      var ratio = item.threshold ? item.value / item.threshold : 1;
      var pos = Math.max(0, Math.min(2, ratio)) / 2 * 100;
      var beyond = ratio > 2;
      return '<div class="ou-scale">' +
        '<div class="ou-bar"><span class="ou-tick" style="left:50%"></span>' +
        '<span class="ou-val' + (beyond ? " is-beyond" : "") + '" style="left:' + pos.toFixed(1) + '%"></span></div>' +
        '<div class="ou-legend"><span>asked: ' + esc(num(item.threshold)) + " " + esc(item.unit) + '</span>' +
        '<span class="ou-actual">actual: <b>' + esc(num(item.value)) + " " + esc(item.unit) + '</b></span></div></div>';
    }
    function answer(call) {
      if (answered || !cur) return;
      answered = true;
      var ok = call === direction(cur);
      progress[cur.id] = { right: ok, at: clock() }; save();
      done++; if (ok) right++;
      var btns = box.querySelectorAll(".ou-choice");
      for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
        var c = btns[i].getAttribute("data-call");
        if (c === direction(cur)) btns[i].classList.add("fc-right");
        else if (c === call) btns[i].classList.add("fc-wrong");
      }
      box.querySelector(".fc-feedback").innerHTML =
        '<div class="fc-verdict ' + (ok ? "fc-v-ok" : "fc-v-bad") + '">' +
        (ok ? "Called it." : "The other way.") + '</div>' + scale(cur) +
        '<p class="fc-explain">' + rich(cur.explain || "") + '</p>' +
        '<div class="fc-actions"><button type="button" class="btn fc-next" data-act="next">Next summary</button>' +
        '<a class="fc-source" href="' + esc(cur.href || data.reference) + '" target="_blank" rel="noopener">' +
        esc("what produced it: " + cur.source) + '</a></div>';
      renderStatus();
    }
    function renderSummary() {
      box.innerHTML = '<div class="fc-card"><div class="fc-idle-title">Round complete: ' + right + ' of ' + roundLen + ' called right.</div>' +
        '<p class="fc-explain">Guessing gets half of them. Anything above that is knowledge of the numbers.</p>' +
        '<div class="fc-actions"><button type="button" class="btn" data-act="start">Another round</button></div></div>';
      cur = null; renderStatus();
    }
    function onClick(e) {
      var t = e.target;
      while (t && t !== root && !(t.getAttribute && (t.getAttribute("data-call") || t.getAttribute("data-act")))) t = t.parentNode;
      if (!t || t === root) return;
      var call = t.getAttribute("data-call"), act = t.getAttribute("data-act");
      if (call) answer(call);
      else if (act === "next") next();
      else if (act === "start") startRound();
      else if (act === "hint") {
        var row = box.querySelector(".fc-hint-row");
        if (row) { row.querySelector(".fc-hintbtn").style.display = "none"; row.querySelector(".fc-hint").innerHTML = rich(cur.hint); }
      } else if (act === "reset-progress") {
        if (!opts.confirm || opts.confirm("Reset all progress for this drill?")) { progress = {}; save(); startRound(); }
      }
    }
    function onKey(e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) return;
      if (cur && !answered && (e.key === "o" || e.key === "O")) { answer("over"); e.preventDefault(); }
      else if (cur && !answered && (e.key === "u" || e.key === "U")) { answer("under"); e.preventDefault(); }
      else if (cur && !answered && e.key === "h") { onClick({ target: box.querySelector(".fc-hintbtn") || box }); e.preventDefault(); }
      else if (cur && answered && e.key === "Enter") { next(); e.preventDefault(); }
    }
    root.addEventListener("click", onClick);
    if (opts.keyTarget) opts.keyTarget.addEventListener("keydown", onKey);
    startRound();
    return { answer: answer, next: next };
  }

  var api = { mount: mount, buildRound: buildRound, direction: direction };
  if (typeof window !== "undefined") window.OverUnder = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
