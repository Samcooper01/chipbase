/* Games: spot the pathology. A heat map from a real run is shown, and the
   player says what it means. Three shapes of question:

     name   one map, four readings of it, pick the right one
     pair   two maps of the same design, say which one is healthy
     spot   one map, click the region the question asks for

   A spot item carries its targets as fractions of the image, so they survive
   any rendered size: {x, y, w, h} with 0,0 at the top left. A click inside
   any target counts, because "click a tile at capacity" usually has several
   right answers. The reveal draws every target, so a miss still shows where
   they were.

   Progress is kept in the browser (localStorage), one record per set.

   A spot item can also be answered from the keyboard: the map is divided into
   nine numbered parts, and pressing 1 to 9 picks one. A pick counts when the
   centre of any target lies inside it, which is a coarser question than a
   click but the same question.

   window.Pathology = { mount, hit, ninth, hitNinth, buildRound }. */
(function () {
  "use strict";
  var ROUND_SIZE = 6;

  function hit(fx, fy, targets) {
    return (targets || []).some(function (t) {
      return fx >= t.x && fx <= t.x + t.w && fy >= t.y && fy <= t.y + t.h;
    });
  }
  /* the nine parts of the map, numbered left to right and top to bottom */
  function ninth(i) { return { x: (i % 3) / 3, y: Math.floor(i / 3) / 3, w: 1 / 3, h: 1 / 3 }; }
  function hitNinth(i, targets) {
    var n = ninth(i);
    return (targets || []).some(function (t) {
      var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      return cx >= n.x && cx <= n.x + n.w && cy >= n.y && cy <= n.y + n.h;
    });
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
    var KEY = "pdleet-pa-" + data.game, BASE = data.image_base || "/static/games/pathology/";
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
      statusEl.innerHTML = '<span><b>' + data.items.length + '</b> maps</span><span><b>' + seen + '</b> seen</span>' +
        '<span><b>' + (seen ? Math.round((100 * ok) / seen) : 0) + '%</b> read right</span>' +
        '<button type="button" class="fc-linkbtn" data-act="reset-progress">reset progress</button>';
    }
    function figure(file, caption, cls) {
      return '<figure class="pa-fig ' + (cls || "") + '">' +
        '<img class="pa-img" src="' + esc(BASE + file) + '" alt="' + esc(caption) + '" draggable="false">' +
        '<figcaption>' + esc(caption) +
        ' <a class="pa-larger" href="' + esc(BASE + file) + '" target="_blank" rel="noopener">full size</a>' +
        '</figcaption></figure>';
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
      var html = '<div class="fc-card pa-card" data-item="' + esc(cur.id) + '" data-style="' + esc(cur.style) + '">' +
        '<div class="fc-meta"><span class="chip fc-topic">' + esc(cur.topic || "") + '</span>' +
        '<span class="fc-count">map ' + (done + 1) + ' of ' + roundLen + '</span></div>';
      if (cur.style === "pair") {
        html += '<div class="pa-pair">' + figure(cur.images.a, "left") + figure(cur.images.b, "right") + '</div>' +
          '<p class="pa-caption">' + esc(cur.caption) + '</p>' +
          '<div class="fc-question">' + esc(cur.question) + '</div>' +
          '<div class="ou-choices"><button type="button" class="ou-choice" data-call="a"><b>left</b></button>' +
          '<button type="button" class="ou-choice" data-call="b"><b>right</b></button></div>';
      } else {
        var grid = "";
        if (cur.style === "spot") {
          for (var g = 0; g < 9; g++) {
            var n = ninth(g);
            grid += '<span class="pa-ninth" data-ninth="' + g + '" style="left:' + (n.x * 100) + '%;top:' + (n.y * 100) +
              '%;width:' + (100 / 3) + '%;height:' + (100 / 3) + '%"><i>' + (g + 1) + '</i></span>';
          }
        }
        html += '<div class="pa-stage">' + figure(cur.image, cur.caption) +
          (grid ? '<div class="pa-grid">' + grid + '</div>' : "") + '<div class="pa-overlay"></div></div>';
        html += '<div class="fc-question">' + esc(cur.question) + '</div>';
        if (cur.style === "name") {
          var opts2 = shuffled([{ t: cur.answer, ok: true }].concat(cur.wrong.map(function (w) { return { t: w, ok: false }; })), rng);
          cur._opts = opts2;
          html += '<div class="fc-options">';
          opts2.forEach(function (o, i) {
            html += '<button type="button" class="fc-option" data-opt="' + i + '"><span class="fc-key">' + (i + 1) +
              '</span><span>' + rich(o.t) + '</span></button>';
          });
          html += '</div>';
        } else {
          html += '<p class="pa-hintline">Click on the map, or press <b>1</b> to <b>9</b> to choose one of the numbered parts. One wrong answer ends the question.</p>';
        }
      }
      html += '<div class="fc-feedback"></div></div>';
      box.innerHTML = html;
      renderStatus();
    }
    function settle(ok) {
      answered = true;
      progress[cur.id] = { right: ok, at: clock() }; save();
      done++; if (ok) right++;
      box.querySelector(".fc-feedback").innerHTML =
        '<div class="fc-verdict ' + (ok ? "fc-v-ok" : "fc-v-bad") + '">' + (ok ? "Read correctly." : "Not what it says.") + '</div>' +
        '<p class="pa-describe">' + rich(cur.describe || "") + '</p>' +
        '<p class="fc-explain">' + rich(cur.explain || "") + '</p>' +
        (cur.fact ? '<div class="fc-fix"><span class="fc-fix-label">The numbers behind it</span><pre>' + esc(cur.fact) + '</pre></div>' : "") +
        '<div class="fc-actions"><button type="button" class="btn fc-next" data-act="next">Next map</button>' +
        '<span class="fc-source">from the run: ' + esc(cur.source) + '</span></div>';
      renderStatus();
    }
    function answerName(i) {
      if (answered || !cur || !cur._opts || !cur._opts[i]) return;
      var btns = box.querySelectorAll(".fc-option");
      for (var k = 0; k < btns.length; k++) {
        btns[k].disabled = true;
        if (cur._opts[k].ok) btns[k].classList.add("fc-right");
        else if (k === i) btns[k].classList.add("fc-wrong");
      }
      settle(cur._opts[i].ok);
    }
    function answerPair(call) {
      if (answered || !cur) return;
      var btns = box.querySelectorAll(".ou-choice");
      for (var k = 0; k < btns.length; k++) {
        btns[k].disabled = true;
        var c = btns[k].getAttribute("data-call");
        if (c === cur.answer) btns[k].classList.add("fc-right");
        else if (c === call) btns[k].classList.add("fc-wrong");
      }
      settle(call === cur.answer);
    }
    function answerSpot(ev) {
      if (answered || !cur || cur.style !== "spot") return;
      var img = box.querySelector(".pa-img"), r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
      var ok = hit(fx, fy, cur.targets);
      var over = box.querySelector(".pa-overlay");
      var marks = cur.targets.map(function (t) {
        return '<span class="pa-target" style="left:' + (t.x * 100) + '%;top:' + (t.y * 100) +
          '%;width:' + (t.w * 100) + '%;height:' + (t.h * 100) + '%"></span>';
      }).join("");
      over.innerHTML = marks + '<span class="pa-click' + (ok ? " is-hit" : " is-miss") +
        '" style="left:' + (fx * 100) + '%;top:' + (fy * 100) + '%"></span>';
      over.classList.add("is-shown");
      settle(ok);
    }
    function answerNinth(i) {
      if (answered || !cur || cur.style !== "spot") return;
      var ok = hitNinth(i, cur.targets), n = ninth(i);
      var over = box.querySelector(".pa-overlay");
      over.innerHTML = cur.targets.map(function (t) {
        return '<span class="pa-target" style="left:' + (t.x * 100) + '%;top:' + (t.y * 100) +
          '%;width:' + (t.w * 100) + '%;height:' + (t.h * 100) + '%"></span>';
      }).join("") + '<span class="pa-picked' + (ok ? " is-hit" : " is-miss") + '" style="left:' + (n.x * 100) +
        '%;top:' + (n.y * 100) + '%;width:' + (100 / 3) + '%;height:' + (100 / 3) + '%"></span>';
      over.classList.add("is-shown");
      var gridEl = box.querySelector(".pa-grid"); if (gridEl) gridEl.classList.add("is-done");
      settle(ok);
    }
    function onClick(e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("pa-img") && cur && cur.style === "spot") { answerSpot(e); return; }
      while (t && t !== root && !(t.getAttribute && (t.getAttribute("data-opt") !== null || t.getAttribute("data-call") || t.getAttribute("data-act")))) t = t.parentNode;
      if (!t || t === root) return;
      var opt = t.getAttribute("data-opt"), call = t.getAttribute("data-call"), act = t.getAttribute("data-act");
      if (opt !== null && opt !== undefined) answerName(parseInt(opt, 10));
      else if (call) answerPair(call);
      else if (act === "next") next();
      else if (act === "start") startRound();
      else if (act === "reset-progress") {
        if (!opts.confirm || opts.confirm("Reset all progress for this drill?")) { progress = {}; save(); startRound(); }
      }
    }
    function renderSummary() {
      box.innerHTML = '<div class="fc-card"><div class="fc-idle-title">Round complete: ' + right + ' of ' + roundLen + ' read correctly.</div>' +
        '<div class="fc-actions"><button type="button" class="btn" data-act="start">Another round</button></div></div>';
      cur = null; renderStatus();
    }
    function onKey(e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) return;
      if (cur && !answered && cur.style === "name" && /^[1-4]$/.test(e.key)) { answerName(parseInt(e.key, 10) - 1); e.preventDefault(); }
      else if (cur && !answered && cur.style === "pair" && /^[ab]$/i.test(e.key)) { answerPair(e.key.toLowerCase()); e.preventDefault(); }
      else if (cur && !answered && cur.style === "spot" && /^[1-9]$/.test(e.key)) { answerNinth(parseInt(e.key, 10) - 1); e.preventDefault(); }
      else if (cur && answered && e.key === "Enter") { next(); e.preventDefault(); }
    }
    root.addEventListener("click", onClick);
    if (opts.keyTarget) opts.keyTarget.addEventListener("keydown", onKey);
    startRound();
    return { next: next, state: function () { return { cur: cur && cur.id, answered: answered }; } };
  }

  var api = { mount: mount, hit: hit, ninth: ninth, hitNinth: hitNinth, buildRound: buildRound };
  if (typeof window !== "undefined") window.Pathology = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
