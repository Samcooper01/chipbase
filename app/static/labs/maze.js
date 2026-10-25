/* Maze routing lab (Lee's algorithm). A wavefront floods out from the source,
   labeling every reachable cell with its distance and flowing around blockages.
   When the wave reaches the target, the shortest route is found by BACKTRACING
   from the target down the gradient: each step moves to a neighbour whose label
   is one smaller, until it reaches the source. The learner runs the wave, then
   traces the path back. window.Maze = { evaluate, mount }. */
(function () {
  "use strict";
  function bfsDist(spec) {
    var blocked = {}; spec.blocks.forEach(function (b) { blocked[b[0] + "," + b[1]] = true; });
    var S = spec.source, dist = {}; dist[S[0] + "," + S[1]] = 0;
    var q = [[S[0], S[1]]];
    while (q.length) {
      var cur = q.shift(), d = dist[cur[0] + "," + cur[1]];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (m) {
        var nc = cur[0] + m[0], nr = cur[1] + m[1], k = nc + "," + nr;
        if (nc < 0 || nc >= spec.cols || nr < 0 || nr >= spec.rows || blocked[k] || dist[k] !== undefined) return;
        dist[k] = d + 1; q.push([nc, nr]);
      });
    }
    return { dist: dist, blocked: blocked };
  }
  function evaluate(spec, path) {
    var bd = bfsDist(spec), dist = bd.dist;
    var S = spec.source, T = spec.target, sk = S[0] + "," + S[1], tk = T[0] + "," + T[1];
    if (!path.length || path[0] !== tk) return { valid: false, complete: false, pass: false };
    var valid = true;
    for (var i = 1; i < path.length; i++) {
      var a = path[i - 1].split(",").map(Number), b = path[i].split(",").map(Number);
      var adj = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
      if (!adj || dist[path[i]] === undefined || dist[path[i]] !== dist[path[i - 1]] - 1) { valid = false; break; }
    }
    var complete = valid && path[path.length - 1] === sk;
    return { valid: valid, complete: complete, len: path.length - 1, distT: dist[tk], pass: complete };
  }

  function mount(container, spec) {
    var PAD = 20, CELL = Math.floor(Math.min(470 / spec.cols, 380 / spec.rows));
    var W = spec.cols * CELL + PAD * 2, Hpx = spec.rows * CELL + PAD * 2;
    var bd = bfsDist(spec), dist = bd.dist, blocked = bd.blocked;
    var S = spec.source, T = spec.target, sk = S[0] + "," + S[1], tk = T[0] + "," + T[1];
    var distT = dist[tk] || 0;
    var ring = 0, timer = null, phase = "idle", path = [], scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Step 1: <b>Run wave</b> to flood the distance labels out from S. Step 2: starting at T, click cells whose label is one lower each step, tracing the path back to S.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bWave = document.createElement("button"); bWave.className = "btn mp-submit"; bWave.textContent = "Run wave";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bWave); ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function cx(c) { return PAD + c * CELL; } function cy(r) { return PAD + r * CELL; }
    function waveColor(d) { var t = distT ? d / distT : 0; var hue = 200 - 160 * Math.min(1, t); return "hsl(" + hue.toFixed(0) + ",78%," + (86 - 30 * Math.min(1, t)).toFixed(0) + "%)"; }
    function draw() {
      ctx.clearRect(0, 0, W, Hpx);
      var pathSet = {}; path.forEach(function (p) { pathSet[p] = true; });
      for (var r = 0; r < spec.rows; r++) for (var c = 0; c < spec.cols; c++) {
        var k = c + "," + r, d = dist[k];
        if (blocked[k]) ctx.fillStyle = "#8b8f98";
        else if (pathSet[k]) ctx.fillStyle = "#15803d";
        else if (d !== undefined && d <= ring) ctx.fillStyle = waveColor(d);
        else ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(cx(c), cy(r), CELL - 1, CELL - 1);
        ctx.strokeStyle = "rgba(120,125,135,0.22)"; ctx.lineWidth = 0.5; ctx.strokeRect(cx(c), cy(r), CELL - 1, CELL - 1);
        /* distance label once revealed */
        if (!blocked[k] && d !== undefined && d <= ring && CELL >= 20) {
          ctx.fillStyle = pathSet[k] ? "#fff" : (d === ring && phase === "expanding" ? "#1a1d26" : "rgba(40,45,60,0.6)");
          ctx.font = (d === ring && phase === "expanding" ? "bold " : "") + Math.max(8, CELL * 0.34).toFixed(0) + "px 'JetBrains Mono', monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d, cx(c) + CELL / 2, cy(r) + CELL / 2);
        }
      }
      /* S and T markers */
      ctx.fillStyle = "#15803d"; ctx.fillRect(cx(S[0]) + 1, cy(S[1]) + 1, CELL - 3, CELL - 3);
      ctx.fillStyle = "#dc2626"; ctx.fillRect(cx(T[0]) + 1, cy(T[1]) + 1, CELL - 3, CELL - 3);
      ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.max(9, CELL * 0.4).toFixed(0) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("S", cx(S[0]) + CELL / 2, cy(S[1]) + CELL / 2); ctx.fillText("T", cx(T[0]) + CELL / 2, cy(T[1]) + CELL / 2);
      /* highlight the backtrace tip */
      if (phase === "backtrace" && path.length) { var tip = path[path.length - 1].split(",").map(Number); ctx.strokeStyle = "#d97706"; ctx.lineWidth = 2.4; ctx.strokeRect(cx(tip[0]) + 1, cy(tip[1]) + 1, CELL - 3, CELL - 3); }
    }
    function render(res) {
      var html;
      if (phase === "idle") html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">ready</div><div class="mp-score"><span class="mp-score-note">Click <b>Run wave</b> to flood the distance field out from the source with Lee\'s algorithm.</span></div>';
      else if (phase === "expanding") html = '<div class="mp-verdict" style="background:#dbeafe;color:#1d4ed8">wave expanding</div><div class="mp-score"><span class="mp-score-note">The wavefront is flooding out ring by ring around the blockages. Reached distance ' + ring + '.</span></div>';
      else {
        var done = res.complete;
        html = '<div class="mp-verdict ' + (done ? "mp-pass" : "mp-fail") + '">' + (done ? "PASS" : "trace it back") + '</div>';
        html += '<div class="mp-row ' + (done ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (done ? "✔" : "○") + '</span><span class="mp-label">Backtrace T &rarr; S down the gradient</span><span class="mp-detail">' + (path.length - 1) + " / " + distT + ' steps</span></div>';
        if (done && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">The backtrace along the wave is a guaranteed shortest path (' + distT + ' cells).</div></div>';
        else if (done) html += '<div class="mp-flow mp-flow-ready"><b>Reached S - shortest path traced.</b> Click <b>Submit design</b> to score it.</div>';
        else html += '<div class="mp-score"><span class="mp-score-note">From the current tip (orange), click an adjacent cell labelled one lower. Keep going down to 0 at S. Click the tip\'s previous cell to undo.</span></div>';
      }
      panel.innerHTML = html;
    }
    function refreshBtns() {
      var res = evaluate(spec, path);
      bSubmit.disabled = !(phase === "backtrace" && res.complete);
      bSubmit.classList.toggle("mp-ready", phase === "backtrace" && res.complete);
      bWave.disabled = phase === "expanding";
      return res;
    }
    function refresh() { draw(); render(refreshBtns()); }
    function computeScore() {
      var total = 10000, best = total;
      try { var key = "mp-best-" + (spec.id || "route-maze"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function runWave() {
      if (timer) clearInterval(timer);
      phase = "expanding"; ring = 0; path = []; scoreObj = null; refresh();
      timer = setInterval(function () {
        ring++;
        if (ring >= distT) { ring = distT; clearInterval(timer); timer = null; phase = "backtrace"; path = [tk]; }
        refresh();
      }, 130);
    }
    function cellAt(e) { var r0 = canvas.getBoundingClientRect(); return [Math.floor(((e.touches ? e.touches[0].clientX : e.clientX) - r0.left - PAD) / CELL), Math.floor(((e.touches ? e.touches[0].clientY : e.clientY) - r0.top - PAD) / CELL)]; }
    function tap(e) {
      e.preventDefault(); if (phase !== "backtrace") return;
      var p = cellAt(e), k = p[0] + "," + p[1]; if (p[0] < 0 || p[0] >= spec.cols || p[1] < 0 || p[1] >= spec.rows) return;
      var tip = path[path.length - 1];
      if (path.length >= 2 && k === path[path.length - 2]) { path.pop(); scoreObj = null; refresh(); return; }   // undo
      if (path.indexOf(k) >= 0 || blocked[k] || dist[k] === undefined) return;
      var a = tip.split(",").map(Number);
      var adj = Math.abs(a[0] - p[0]) + Math.abs(a[1] - p[1]) === 1;
      if (adj && dist[k] === dist[tip] - 1) { path.push(k); scoreObj = null; refresh(); }
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bWave.addEventListener("click", runWave);
    bSubmit.addEventListener("click", function () { var res = evaluate(spec, path); if (phase === "backtrace" && res.complete) { scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { if (timer) clearInterval(timer); timer = null; phase = "idle"; ring = 0; path = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Maze = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
