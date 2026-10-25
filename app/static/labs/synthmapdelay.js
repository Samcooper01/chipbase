/* Synthesis lab: synth-map-delay (technology mapping, area vs delay).
   The subject graph is a real wide-AND: a chain of 10 two-input AND gates computing
   an 11-input AND (g1 = AND(x1,x2), g2 = AND(g1,x3), ...). Mapping it means grouping
   the chain into library AND cells: a group of k chained AND2 gates becomes one
   AND(k+1) cell. A wider cell collapses more gates into a single logic level, so it
   is faster, but it costs more area. The output arrival is the sum of the cell delays
   along the chain, and it must meet a target. The cheapest-area mapping (all AND2) is
   too slow; the fastest (all AND4) over-spends area. The balance that just meets the
   target is five AND3 cells: delay 15, area 25. window.SynthMapDelay = { evaluate, mount }. */
(function () {
  "use strict";
  var GN = 10, TARGET = 15, OPT_AREA = 25;
  var TILE = { 1: { cell: "AND2", area: 2, delay: 2 }, 2: { cell: "AND3", area: 5, delay: 3 }, 3: { cell: "AND4", area: 9, delay: 4 } };
  function groupsOf(cuts) {
    var bnds = []; for (var i = 0; i < GN - 1; i++) if (cuts[i]) bnds.push(i + 1);
    var pts = [0].concat(bnds).concat([GN]), g = [];
    for (var j = 0; j < pts.length - 1; j++) g.push({ lo: pts[j] + 1, hi: pts[j + 1], size: pts[j + 1] - pts[j] });
    return g;
  }
  function analyze(cuts) {
    var groups = groupsOf(cuts), area = 0, delay = 0, allValid = true;
    groups.forEach(function (gr) {
      var t = TILE[gr.size]; gr.valid = !!t;
      if (t) { gr.cell = t.cell; gr.area = t.area; gr.delay = t.delay; area += t.area; delay += t.delay; }
      else { gr.cell = "AND" + (gr.size + 1) + "?"; allValid = false; }
    });
    var delayOK = allValid && delay <= TARGET;
    return { groups: groups, area: area, delay: delay, allValid: allValid, delayOK: delayOK, pass: allValid && delay <= TARGET && area <= OPT_AREA };
  }
  function evaluate(spec, cuts) { return analyze(cuts || []); }

  function mount(container, spec) {
    var W = 580, Hpx = 300, dpr = window.devicePixelRatio || 1;
    var cuts = []; for (var i = 0; i < GN - 1; i++) cuts.push(true); // start: every gate its own AND2 (too slow)
    var submitted = false, scoreObj = null;
    var x0 = 52, step = 48, gw = 30, gy = 122;
    function gcx(i) { return x0 + i * step; }              // gate i center, i=0..GN-1
    function bndX(i) { return gcx(i) + step / 2; }          // boundary after gate i+1, i=0..GN-2

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "This circuit is a wide AND: 10 two-input AND gates chained into an 11-input AND. Mapping groups the chain into library AND cells: a group of <b>k</b> gates becomes one <b>AND(k+1)</b> cell (up to AND4). A wider cell does more in one logic level, so it is <b>faster</b> but costs more <b>area</b>. The arrival is the sum of the cell delays along the chain, and must meet the target (" + TARGET + "). Right now every gate is its own AND2, which is cheapest but too slow. <b>Click a boundary</b> between two gates to merge them into one wider cell (or split again). Meet the target at the <b>least area</b>, then <b>Submit mapping</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit mapping";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var MET = "#3b82f6", OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", CELLC = "#2563eb";
    var PAL = ["rgba(13,148,136,0.13)", "rgba(124,58,237,0.13)", "rgba(37,99,237,0.13)", "rgba(190,24,93,0.12)", "rgba(180,83,9,0.12)"];
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* chain wire */
      ctx.strokeStyle = MET; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(gcx(0) - 26, gy); ctx.lineTo(gcx(GN - 1) + 26, gy); ctx.stroke();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("out", gcx(GN - 1) + 30, gy);
      /* group cells (drawn behind gates) */
      res.groups.forEach(function (gr, gi) {
        var xa = gcx(gr.lo - 1) - gw / 2 - 5, xb = gcx(gr.hi - 1) + gw / 2 + 5;
        var valid = gr.valid;
        ctx.fillStyle = valid ? PAL[gi % PAL.length] : "rgba(220,38,38,0.14)"; ctx.strokeStyle = valid ? CELLC : BAD; ctx.lineWidth = valid ? 1.8 : 2.2;
        ctx.fillRect(xa, gy - 30, xb - xa, 60); ctx.strokeRect(xa, gy - 30, xb - xa, 60);
        ctx.fillStyle = valid ? "#1a1d26" : BAD; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(valid ? gr.cell : "no cell (>AND4)", (xa + xb) / 2, gy - 32);
        if (valid) { ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textBaseline = "top"; ctx.fillText("a" + gr.area + " d" + gr.delay, (xa + xb) / 2, gy + 32); }
      });
      /* gates */
      for (var i = 0; i < GN; i++) {
        var x = gcx(i);
        ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.3; ctx.fillRect(x - gw / 2, gy - 13, gw, 26); ctx.strokeRect(x - gw / 2, gy - 13, gw, 26);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("&", x, gy - 3);
        ctx.fillStyle = MUT; ctx.font = "6px 'JetBrains Mono', monospace"; ctx.fillText("g" + (i + 1), x, gy + 7);
      }
      /* boundary toggles */
      for (var b = 0; b < GN - 1; b++) {
        var bx = bndX(b), cut = cuts[b];
        ctx.strokeStyle = cut ? "#334155" : "#c9c6bd"; ctx.lineWidth = cut ? 2 : 1; if (!cut) ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(bx, gy - 15); ctx.lineTo(bx, gy + 15); ctx.stroke(); ctx.setLineDash([]);
        hits.push([bx - 10, gy - 30, bx + 10, gy + 30, b]);
      }
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("solid line = cell boundary, dashed = merged into one cell (click to toggle)", W / 2, gy + 48);
      /* delay bar */
      var by = 236, bx0 = 40, bw = W - 80, tmax = 22, sc = bw / tmax, lim = bx0 + TARGET * sc;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("output arrival (sum of cell delays)", bx0, by - 4);
      ctx.fillStyle = "#eceae2"; ctx.fillRect(bx0, by, bw, 18); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(bx0, by, bw, 18);
      if (res.allValid) { var dw = Math.min(bw, res.delay * sc); ctx.fillStyle = res.delayOK ? "rgba(21,128,61,0.55)" : "rgba(220,38,38,0.55)"; ctx.fillRect(bx0, by, dw, 18); }
      ctx.strokeStyle = "#c23c32"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(lim, by - 6); ctx.lineTo(lim, by + 24); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#c23c32"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("target " + TARGET, lim, by - 4);
      if (res.allValid) { ctx.fillStyle = res.delayOK ? OK : BAD; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("arrival " + res.delay + "  ·  area " + res.area + "  ·  " + res.groups.length + " cells", bx0, by + 34); }
      else { ctx.fillStyle = BAD; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("a cell spans more than 3 gates: no such library cell", bx0, by + 34); }
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.area - OPT_AREA) * 800)), best = total; try { var key = "mp-best-" + (spec.id || "synth-map-delay"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var head = res.pass ? "meets target at least area" : (!res.allValid ? "invalid cell" : (res.delayOK ? "meets target, but larger than needed" : "too slow"));
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + head + '</div>';
      html += '<div class="mp-row ' + (res.allValid ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.allValid ? "✔" : "✗") + '</span><span class="mp-label">Every cell exists (&le; AND4)</span><span class="mp-detail">' + (res.allValid ? "yes" : "group too wide") + '</span></div>';
      html += '<div class="mp-row ' + (res.delayOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.delayOK ? "✔" : "✗") + '</span><span class="mp-label">Arrival &le; target</span><span class="mp-detail">' + (res.allValid ? res.delay : "-") + " / " + TARGET + '</span></div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Total area</span><span class="mp-detail">' + (res.allValid ? res.area : "-") + " (min " + OPT_AREA + ")</span></div>";
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Five AND3 cells: arrival 15 meets the target at area 25. All AND2 is cheaper (area 20) but too slow (arrival 20), and all AND4 is faster than needed (arrival 14) at area 29. The balance is to widen cells just enough to hit the target.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Meets the target.</b> Click <b>Submit mapping</b>.</div>';
      else if (!res.allValid) html += '<div class="mp-score"><span class="mp-score-note">A merged group is wider than 3 gates, and the library only goes up to AND4. Split it with a boundary.</span></div>';
      else if (!res.delayOK) html += '<div class="mp-score"><span class="mp-score-note">Too slow (arrival ' + res.delay + ' &gt; ' + TARGET + '). Merge more gates into wider cells (AND3 / AND4): fewer logic levels means less delay.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">You meet the target but spent too much area (' + res.area + ' &gt; ' + OPT_AREA + '). Some cells are wider (faster) than the target needs. Widen only enough to just meet it.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, cuts); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { cuts[h[4]] = !cuts[h[4]]; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { cuts = []; for (var i = 0; i < GN - 1; i++) cuts.push(true); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthMapDelay = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
