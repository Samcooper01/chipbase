/* Physical Verification lab: pv-lvs-connectivity (shorts and opens).
   Layout Versus Schematic (LVS) extracts the layout's connectivity and compares
   it to the schematic net list. Two terminals must be connected exactly when the
   schematic puts them on the same net. A SHORT is metal joining different nets
   (and it can cascade: joining net X to net Y through a pad of net Z merges all
   three). An OPEN is a missing connection that breaks one net. The die is a grid
   of pads with candidate connections (horizontal along a row, vertical between
   rows); the learner adds and removes metal until connectivity matches the
   schematic. window.PvLvs = { evaluate, mount }. */
(function () {
  "use strict";
  var COLS = [80, 180, 280, 380, 480], ROWY = [92, 212];
  var R1 = ["A", "D", "B", "B", "C"], R2 = ["A", "D", "B", "C", "C"];
  var NETCOL = { A: "#2563eb", B: "#d97706", C: "#0f9d8c", D: "#7c3aed" };
  var TERMS = [], NET = {};
  for (var c = 0; c < 5; c++) {
    TERMS.push({ id: "r1c" + c, x: COLS[c], y: ROWY[0], net: R1[c] }); NET["r1c" + c] = R1[c];
    TERMS.push({ id: "r2c" + c, x: COLS[c], y: ROWY[1], net: R2[c] }); NET["r2c" + c] = R2[c];
  }
  var SLOTS = [];
  for (var cc = 0; cc < 4; cc++) { SLOTS.push({ id: "h1_" + cc, t1: "r1c" + cc, t2: "r1c" + (cc + 1), kind: "seg" }); SLOTS.push({ id: "h2_" + cc, t1: "r2c" + cc, t2: "r2c" + (cc + 1), kind: "seg" }); }
  for (var cv = 0; cv < 5; cv++) SLOTS.push({ id: "v" + cv, t1: "r1c" + cv, t2: "r2c" + cv, kind: "bridge" });
  var INIT = { v0: true, v1: true, v2: true, h2_3: true, h1_3: true, h2_1: true }; // defective start

  function pos(id) { for (var i = 0; i < TERMS.length; i++) if (TERMS[i].id === id) return TERMS[i]; }
  function comps(present) {
    var p = {}; Object.keys(NET).forEach(function (t) { p[t] = t; });
    function f(x) { return p[x] === x ? x : (p[x] = f(p[x])); }
    SLOTS.forEach(function (s) { if (present[s.id]) p[f(s.t1)] = f(s.t2); });
    return f;
  }
  function evaluate(spec, present) {
    var f = comps(present), ids = Object.keys(NET), shorts = [], opens = [];
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var sn = NET[ids[i]] === NET[ids[j]], sc = f(ids[i]) === f(ids[j]);
      if (sn && !sc) opens.push(NET[ids[i]]);
      if (!sn && sc) shorts.push([NET[ids[i]], NET[ids[j]]].sort().join("/"));
    }
    function u(a) { return a.filter(function (v, k) { return a.indexOf(v) === k; }); }
    return { shorts: u(shorts), opens: u(opens), pass: shorts.length === 0 && opens.length === 0 };
  }
  function slotFlags(present) {
    var f = comps(present), flag = {};
    SLOTS.forEach(function (s) {
      var same = NET[s.t1] === NET[s.t2];
      if (present[s.id] && !same) flag[s.id] = "short";
      else if (!present[s.id] && same && f(s.t1) !== f(s.t2)) flag[s.id] = "open";
    });
    return flag;
  }

  function mount(container, spec) {
    var W = 560, Hpx = 300, dpr = window.devicePixelRatio || 1;
    var present = {}; SLOTS.forEach(function (s) { present[s.id] = !!INIT[s.id]; });
    var submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Each pad is labelled with the net it belongs to. <b>Click a connection</b> (between two pads) to add metal (dashed) or remove it (solid). Audit every connection: join each net's own pads (fix the <b>opens</b>) and separate different nets (fix the <b>shorts</b>). A short can cascade, merging three nets through a shared pad.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit layout";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);

    var rightCol = document.createElement("div"); rightCol.style.cssText = "display:flex;flex-direction:column;gap:12px";
    var sch = document.createElement("div"); sch.style.cssText = "border:1px solid #c9c6bd;border-radius:8px;padding:12px 14px;background:#faf9f5;min-width:150px";
    sch.innerHTML = '<div style="font:700 13px \'JetBrains Mono\',monospace;color:#1a1d26;margin-bottom:2px">Schematic nets</div>'
      + '<div style="font:9px \'JetBrains Mono\',monospace;color:#8a90a0;margin-bottom:8px">connect within, separate across</div>'
      + '<div style="font:12px/1.9 \'JetBrains Mono\',monospace">'
      + ["A", "B", "C", "D"].map(function (n) { return '<div><span style="display:inline-block;width:11px;height:11px;background:' + NETCOL[n] + ';border-radius:2px;vertical-align:middle;margin-right:6px"></span>net ' + n + '</div>'; }).join("")
      + '</div>';
    var panel = document.createElement("div"); panel.className = "mp-panel";
    rightCol.appendChild(sch); rightCol.appendChild(panel); wrap.appendChild(rightCol);
    container.appendChild(wrap);

    var MET = "#3b82f6", BAD = "#dc2626", MUT = "#b4b9c4", DIM = "#334155";
    var hits = [];
    function draw(res, flags) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      SLOTS.forEach(function (s) {
        var t1 = pos(s.t1), t2 = pos(s.t2), bad = submitted && flags[s.id];
        var col = present[s.id] ? (bad === "short" ? BAD : MET) : (bad === "open" ? BAD : MUT);
        ctx.strokeStyle = col;
        if (present[s.id]) { ctx.lineWidth = 6; ctx.setLineDash([]); } else { ctx.lineWidth = 2; ctx.setLineDash([5, 4]); }
        ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.stroke(); ctx.setLineDash([]);
        var rect = s.kind === "seg" ? [Math.min(t1.x, t2.x) + 10, t1.y - 10, Math.max(t1.x, t2.x) - 10, t1.y + 10]
                                    : [t1.x - 10, Math.min(t1.y, t2.y) + 10, t1.x + 10, Math.max(t1.y, t2.y) - 10];
        hits.push([rect[0], rect[1], rect[2], rect[3], s.id]);
      });
      TERMS.forEach(function (t) {
        ctx.fillStyle = NETCOL[t.net]; ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t.net, t.x, t.y);
      });
      ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      var ly = Hpx - 14, lx = 12;
      [["metal", MET], ["no connection", MUT], ["violation", BAD]].forEach(function (it) {
        ctx.strokeStyle = it[1]; ctx.lineWidth = 4; ctx.setLineDash(it[0] === "no connection" ? [4, 3] : []); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 16, ly); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#5a606e"; ctx.fillText(it[0], lx + 20, ly); lx += 34 + ctx.measureText(it[0]).width;
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-lvs-connectivity"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var n = res.shorts.length + res.opens.length;
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "LVS clean" : n + " mismatch" + (n === 1 ? "" : "es")) + '</div>';
      html += '<div class="mp-row ' + (res.shorts.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.shorts.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">No shorts</span><span class="mp-detail">' + (res.shorts.length ? res.shorts.join(", ") : "none") + '</span></div>';
      html += '<div class="mp-row ' + (res.opens.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.opens.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">No opens</span><span class="mp-detail">' + (res.opens.length ? res.opens.join(", ") : "none") + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every net connects exactly its own pads and no two nets touch, so the extracted netlist matches the schematic.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Connectivity matches the schematic.</b> Click <b>Submit layout</b>.</div>';
      else if (res.shorts.length) html += '<div class="mp-score"><span class="mp-score-note">Shorts join nets that must stay separate (' + res.shorts.join(", ") + '). Find the metal bridging them and remove it. One removal can clear several pairs at once when the short cascades through a shared net.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Opens leave a net broken (' + res.opens.join(", ") + '): its pads are not all connected. Add metal to join them.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, present); draw(last, submitted ? slotFlags(present) : {}); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { present[h[4]] = !present[h[4]]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { SLOTS.forEach(function (s) { present[s.id] = !!INIT[s.id]; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvLvs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
