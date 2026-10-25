/* Via minimization lab. Routing is preferred-direction: horizontal runs go on
   one metal layer and vertical runs on another, so EVERY turn is a via (a layer
   change). Paint a wire corridor from S to T; the router takes the fewest-turn
   path through it. Each turn is drawn as a via marker, and the runs are coloured
   by layer. Reach T within the via budget by favouring long straight runs.
   window.ViaMin = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, wire) {
    var blocked = {}; spec.blocks.forEach(function (b) { blocked[b[0] + "," + b[1]] = true; });
    var sel = {}; wire.forEach(function (w) { sel[w] = true; });
    var S = spec.source, T = spec.target, sk = S[0] + "," + S[1], tk = T[0] + "," + T[1];
    function passable(c, r) { var k = c + "," + r; if (c < 0 || c >= spec.cols || r < 0 || r >= spec.rows) return false; if (blocked[k]) return false; return k === sk || k === tk || sel[k]; }
    // min-turn Dijkstra on (cell, lastDir) with parent tracking
    function key(c, r, d) { return c + "," + r + "," + d; }
    var dist = {}, par = {}, seen = {}, pq = [[0, S[0], S[1], -1]], endK = null;
    dist[key(S[0], S[1], -1)] = 0;
    while (pq.length) {
      pq.sort(function (a, b) { return a[0] - b[0]; });
      var cur = pq.shift(), cost = cur[0], c = cur[1], r = cur[2], ld = cur[3], k = key(c, r, ld);
      if (seen[k]) continue; seen[k] = true;
      if (c === T[0] && r === T[1]) { endK = k; break; }
      [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]].forEach(function (m) {
        var nc = c + m[0], nr = r + m[1], nd = m[2]; if (!passable(nc, nr)) return;
        var ncost = cost + (ld === -1 || ld === nd ? 0 : 1), nk = key(nc, nr, nd);
        if (dist[nk] === undefined || ncost < dist[nk]) { dist[nk] = ncost; par[nk] = k; pq.push([ncost, nc, nr, nd]); }
      });
    }
    var connected = endK !== null, path = [], turns = [];
    if (connected) {
      var chain = [], kk = endK; while (kk !== undefined) { chain.push(kk); kk = par[kk]; } chain.reverse();
      var lastCell = null; chain.forEach(function (st) { var p = st.split(",").map(Number), cell = p[0] + "," + p[1]; if (cell !== lastCell) { path.push(cell); lastCell = cell; } });
      for (var i = 1; i + 1 < path.length; i++) {
        var a = path[i - 1].split(",").map(Number), b = path[i].split(",").map(Number), cc = path[i + 1].split(",").map(Number);
        var d1 = (a[0] === b[0]) ? "V" : "H", d2 = (b[0] === cc[0]) ? "V" : "H";
        if (d1 !== d2) turns.push(path[i]);
      }
    }
    var vias = connected ? turns.length : -1;
    var count = wire.filter(function (w) { return w !== sk && w !== tk; }).length;
    return { connected: connected, vias: vias, path: path, turns: turns, count: count,
      viaOK: connected && vias <= spec.viaBudget, pass: connected && vias <= spec.viaBudget };
  }
  function mount(container, spec) {
    var PAD = 20, CELL = Math.floor(Math.min(500 / spec.cols, 400 / spec.rows));
    var W = spec.cols * CELL + PAD * 2, Hpx = spec.rows * CELL + PAD * 2;
    var blocked = {}; spec.blocks.forEach(function (b) { blocked[b[0] + "," + b[1]] = true; });
    var wire = [], wset = {}, scoreObj = null, painting = false, eraseMode = false;
    var S = spec.source, T = spec.target, sk = S[0] + "," + S[1], tk = T[0] + "," + T[1];
    var LH = "#0d9488", LV = "#7c3aed", VIA = "#ea580c";   // horizontal layer, vertical layer, via

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend-title"; legend.style.display = "block"; legend.style.margin = "8px 0"; legend.style.lineHeight = "1.6";
    legend.innerHTML = '<span style="color:' + LH + ';font-weight:700">&#9644; horizontal = layer M2</span> &nbsp; <span style="color:' + LV + ';font-weight:700">&#9644; vertical = layer M3</span> &nbsp; <span style="color:' + VIA + ';font-weight:700">&#9679; via</span><br>Every turn switches layer, so it needs a via. Paint wire from S to T; keep runs long and straight to spend fewer vias.';
    left.appendChild(legend);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function cx(c) { return PAD + c * CELL; } function cy(r) { return PAD + r * CELL; }
    function ctr(k) { var p = k.split(",").map(Number); return { x: cx(p[0]) + CELL / 2, y: cy(p[1]) + CELL / 2 }; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      for (var r = 0; r < spec.rows; r++) for (var c = 0; c < spec.cols; c++) {
        var k = c + "," + r;
        ctx.fillStyle = blocked[k] ? "#8b8f98" : "#fdfdfd"; ctx.fillRect(cx(c), cy(r), CELL - 1, CELL - 1);
        ctx.strokeStyle = "rgba(120,125,135,0.22)"; ctx.lineWidth = 0.5; ctx.strokeRect(cx(c), cy(r), CELL - 1, CELL - 1);
      }
      /* painted corridor (faint) */
      wire.forEach(function (w) { var p = w.split(",").map(Number); ctx.fillStyle = "rgba(37,99,237,0.12)"; ctx.fillRect(cx(p[0]) + 2, cy(p[1]) + 2, CELL - 5, CELL - 5); });
      /* chosen route: colour each run by layer, mark every turn with a via */
      if (res.connected && res.path.length > 1) {
        var turnSet = {}; res.turns.forEach(function (t) { turnSet[t] = true; });
        ctx.lineWidth = Math.max(3, CELL * 0.16); ctx.lineCap = "round";
        for (var i = 1; i < res.path.length; i++) {
          var a = ctr(res.path[i - 1]), b = ctr(res.path[i]);
          ctx.strokeStyle = (a.y === b.y) ? LH : LV;   // same y = horizontal run
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        /* via markers at turns */
        var vn = 0;
        res.turns.forEach(function (t) {
          var p = ctr(t); vn++;
          ctx.fillStyle = VIA; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(5, CELL * 0.22), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.max(8, CELL * 0.3).toFixed(0) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(vn, p.x, p.y);
        });
      }
      /* S and T */
      ctx.fillStyle = "#15803d"; ctx.fillRect(cx(S[0]) + 1, cy(S[1]) + 1, CELL - 3, CELL - 3);
      ctx.fillStyle = "#dc2626"; ctx.fillRect(cx(T[0]) + 1, cy(T[1]) + 1, CELL - 3, CELL - 3);
      ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.max(9, CELL * 0.4).toFixed(0) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("S", cx(S[0]) + CELL / 2, cy(S[1]) + CELL / 2); ctx.fillText("T", cx(T[0]) + CELL / 2, cy(T[1]) + CELL / 2);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.viaBudget - res.vias + 1) / Math.max(1, spec.viaBudget - spec.par + 1)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "route-viamin"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Source connected to target", res.connected, res.connected ? "routed" : "not connected");
      html += rowc("Vias within budget", res.viaOK, (res.connected ? res.vias : "-") + " / " + spec.viaBudget + " vias");
      if (res.connected) html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">each numbered via is a turn where the wire changes layer (M2 &harr; M3)</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Connected with few vias. Fewer layer changes score higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Connected within the via budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, wire); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function cellAt(e) { var r0 = canvas.getBoundingClientRect(); return [Math.floor(((e.touches ? e.touches[0].clientX : e.clientX) - r0.left - PAD) / CELL), Math.floor(((e.touches ? e.touches[0].clientY : e.clientY) - r0.top - PAD) / CELL)]; }
    function apply(c, r) { var k = c + "," + r; if (c < 0 || c >= spec.cols || r < 0 || r >= spec.rows) return; if (blocked[k] || k === sk || k === tk) return; if (eraseMode) { if (wset[k]) { delete wset[k]; wire = wire.filter(function (w) { return w !== k; }); } } else { if (!wset[k]) { wset[k] = true; wire.push(k); } } scoreObj = null; refresh(); }
    function down(e) { var p = cellAt(e), k = p[0] + "," + p[1]; eraseMode = !!wset[k]; painting = true; apply(p[0], p[1]); e.preventDefault(); }
    function move(e) { if (!painting) return; var p = cellAt(e); apply(p[0], p[1]); e.preventDefault(); }
    function up() { painting = false; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { wire = []; wset = {}; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ViaMin = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
