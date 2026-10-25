/* Physical Verification lab: pv-density.
   Metal density and fill on a real layout grid. The die is a grid of cells;
   dark cells are existing metal. The foundry divides the die into density
   windows and requires each window's metal density (its filled fraction) to sit
   inside a [min, max] band for chemical-mechanical polishing planarity. The
   learner clicks empty cells to add dummy fill and clicks fill cells to remove
   it, until every window is in band. Existing metal is locked.
   window.PvDensity = { evaluate, mount }. */
(function () {
  "use strict";
  var MIN = 0.30, MAX = 0.70, WIN = 3, WROWS = 5, WCOLS = 5, PERWIN = WIN * WIN;
  var R = WROWS * WIN, C = WCOLS * WIN, NWIN = WROWS * WCOLS;
  /* base metal per window (cells of 9), denser in the core, sparse at the edges */
  var PATTERN = [
    [1, 2, 3, 2, 1],
    [2, 4, 5, 4, 2],
    [3, 5, 6, 5, 3],
    [2, 4, 5, 4, 2],
    [1, 2, 3, 2, 1]
  ];
  function baseCount(wr, wc) { return PATTERN[wr][wc]; }
  function buildBase() {
    var g = []; for (var r = 0; r < R; r++) { g.push([]); for (var c = 0; c < C; c++) g[r].push(false); }
    for (var wr = 0; wr < WROWS; wr++) for (var wc = 0; wc < WCOLS; wc++) {
      var cnt = baseCount(wr, wc), k = 0;
      for (var rr = 0; rr < WIN; rr++) for (var cc = 0; cc < WIN; cc++) { if (k < cnt) g[wr * WIN + rr][wc * WIN + cc] = true; k++; }
    }
    return g;
  }
  var BASE = buildBase();

  function windowDensities(fills) {
    var d = {};
    for (var wr = 0; wr < WROWS; wr++) for (var wc = 0; wc < WCOLS; wc++) {
      var n = 0;
      for (var rr = 0; rr < WIN; rr++) for (var cc = 0; cc < WIN; cc++) { var r = wr * WIN + rr, c = wc * WIN + cc; if (BASE[r][c] || fills[r][c]) n++; }
      d[wr + "," + wc] = n / PERWIN;
    }
    return d;
  }
  function evaluate(spec, fills) {
    var dens = windowDensities(fills), low = [], high = [];
    Object.keys(dens).forEach(function (k) { if (dens[k] < MIN - 1e-9) low.push(k); else if (dens[k] > MAX + 1e-9) high.push(k); });
    return { dens: dens, low: low, high: high, inBand: NWIN - low.length - high.length, total: NWIN, pass: low.length === 0 && high.length === 0 };
  }

  function mount(container, spec) {
    var cell = 22, ox = 20, oy = 26, dpr = window.devicePixelRatio || 1;
    var grid = oy + R * cell, W = ox + C * cell + 22, Hpx = grid + 54;
    var fills = []; for (var r = 0; r < R; r++) { fills.push([]); for (var c = 0; c < C; c++) fills[r].push(false); }
    var submitted = false, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The die is split into density windows (thick lines). Each window's metal density must sit in the band <b>" + Math.round(MIN * 100) + "% to " + Math.round(MAX * 100) + "%</b> for CMP (Chemical Mechanical Polishing) planarity. <b>Click an empty cell</b> to add dummy fill, <b>click a fill cell</b> to remove it. Existing metal (dark) is fixed.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit fill";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var METAL = "#1e3a8a", FILL = "#93b8f5", EMPTY = "#eef1f7", GRIDL = "#d7dbe4", OK = "#15803d", BAD = "#dc2626";

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var x = ox + c * cell, y = oy + r * cell;
        ctx.fillStyle = BASE[r][c] ? METAL : (fills[r][c] ? FILL : EMPTY);
        ctx.fillRect(x, y, cell - 1, cell - 1);
        if (fills[r][c]) { ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, cell - 6, cell - 6); }
      }
      ctx.strokeStyle = GRIDL; ctx.lineWidth = 1;
      for (var i = 0; i <= R; i++) { ctx.beginPath(); ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + C * cell, oy + i * cell); ctx.stroke(); }
      for (var j = 0; j <= C; j++) { ctx.beginPath(); ctx.moveTo(ox + j * cell, oy); ctx.lineTo(ox + j * cell, oy + R * cell); ctx.stroke(); }
      for (var wr = 0; wr < WROWS; wr++) for (var wc = 0; wc < WCOLS; wc++) {
        var wx = ox + wc * WIN * cell, wy = oy + wr * WIN * cell, ws = WIN * cell;
        var dens = res.dens[wr + "," + wc], bad = dens < MIN - 1e-9 || dens > MAX + 1e-9;
        ctx.strokeStyle = bad ? BAD : OK; ctx.lineWidth = 3; ctx.strokeRect(wx, wy, ws, ws);
        var label = Math.round(dens * 100) + "%", cw = 40, ch = 15, cxp = wx + ws / 2 - cw / 2, cyp = wy + ws / 2 - ch / 2;
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(cxp, cyp, cw, ch); ctx.strokeStyle = bad ? BAD : OK; ctx.lineWidth = 1.2; ctx.strokeRect(cxp, cyp, cw, ch);
        ctx.fillStyle = bad ? BAD : OK; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, wx + ws / 2, wy + ws / 2);
      }
      var ly = grid + 16, lx = ox;
      [["existing metal", METAL], ["dummy fill", FILL], ["empty", EMPTY]].forEach(function (it) {
        ctx.fillStyle = it[1]; ctx.fillRect(lx, ly, 12, 12); ctx.strokeStyle = GRIDL; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, 12, 12);
        ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(it[0], lx + 16, ly + 6); lx += ctx.measureText(it[0]).width + 40;
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "pv-density"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "clean" : (res.low.length + res.high.length) + " out of band") + '</div>';
      html += '<div class="mp-row ' + (res.low.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.low.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">No window below min</span><span class="mp-detail">' + res.low.length + ' sparse</span></div>';
      html += '<div class="mp-row ' + (res.high.length === 0 ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.high.length === 0 ? "✔" : "✗") + '</span><span class="mp-label">No window above max</span><span class="mp-detail">' + res.high.length + ' too dense</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">' + res.inBand + ' / ' + res.total + ' windows in band</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every window sits in the density band, so the polish planarizes evenly. Filling a window already in band would have pushed it over the ceiling.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every window is in band.</b> Click <b>Submit fill</b>.</div>';
      else if (res.high.length) html += '<div class="mp-score"><span class="mp-score-note">A red window is over the max: you added fill where the metal was already dense enough. Remove fill cells until it drops back into the band.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A red window is below the min. Click its empty cells to add dummy fill until its density reaches at least ' + Math.round(MIN * 100) + '%.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, fills); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var rect = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - rect.left, py = t.clientY - rect.top;
      var c = Math.floor((px - ox) / cell), r = Math.floor((py - oy) / cell);
      if (r >= 0 && r < R && c >= 0 && c < C && !BASE[r][c]) { fills[r][c] = !fills[r][c]; scoreObj = null; refresh(); }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) fills[r][c] = false; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PvDensity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
