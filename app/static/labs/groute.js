/* Global routing / congestion lab. Each net runs from its S to its T as an L and
   can bend two ways; every tile a route crosses uses one unit of that tile's
   track capacity. A tile turns red when more nets cross it than it can hold.
   Hover a net to preview its other bend (dashed); click to switch it, spreading
   the routes so no tile is over capacity. window.GRoute = { evaluate, mount }. */
(function () {
  "use strict";
  var PAL = ["#2563eb", "#d97706", "#0d9488", "#7c3aed", "#be123c", "#0369a1", "#a16207", "#4d7c0f"];
  function heatColor(r) {
    if (r <= 0.5) return "rgba(21,128,61,0.10)";
    if (r <= 1.0) return "rgba(217,119,6,0.20)";
    return "rgba(220,38,38,0.32)";
  }
  /* ordered, one-tile-at-a-time path from S to T so every segment is strictly
     horizontal or vertical (no diagonals). opt 0 = horizontal leg first, opt 1 =
     vertical leg first. */
  function routeTiles(n, opt) {
    var s = n.s, d = n.d, out = [];
    function push(cx, cy) { var k = cx + "," + cy; if (!out.length || out[out.length - 1] !== k) out.push(k); }
    var sx = d[0] >= s[0] ? 1 : -1, sy = d[1] >= s[1] ? 1 : -1, x, y;
    if (opt === 0) {
      for (x = s[0]; x !== d[0] + sx; x += sx) push(x, s[1]);
      for (y = s[1]; y !== d[1] + sy; y += sy) push(d[0], y);
    } else {
      for (y = s[1]; y !== d[1] + sy; y += sy) push(s[0], y);
      for (x = s[0]; x !== d[0] + sx; x += sx) push(x, d[1]);
    }
    return out;
  }
  function evaluate(spec, choice) {
    var u = {};
    spec.nets.forEach(function (n, i) { routeTiles(n, choice[i]).forEach(function (k) { u[k] = (u[k] || 0) + 1; }); });
    var overflow = Object.keys(u).filter(function (k) { return u[k] > spec.cap; });
    var peak = Math.max.apply(null, Object.keys(u).map(function (k) { return u[k]; }).concat(0));
    return { usage: u, overflow: overflow, peak: peak, pass: overflow.length === 0 };
  }
  function mount(container, spec) {
    var PAD = 26, CELL = Math.floor(Math.min(520 / spec.cols, 430 / spec.rows));
    var W = spec.cols * CELL + PAD * 2, Hpx = spec.rows * CELL + PAD * 2;
    var choice = spec.start.slice(), scoreObj = null, hover = -1;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Each coloured line is one net, from its filled dot (S) to its ring (T). A tile shows how many nets cross it; it turns <b>red</b> when that exceeds its capacity. Hover a net to preview its other route (dashed), then click to switch it.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function tc(k) { var p = k.split(",").map(Number); return { x: PAD + (p[0] + 0.5) * CELL, y: PAD + (p[1] + 0.5) * CELL }; }
    function netPts(i, opt) { return routeTiles(spec.nets[i], opt == null ? choice[i] : opt).map(tc); }
    function drawPath(pts, color, width, dashed, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
      ctx.lineCap = dashed ? "butt" : "round";
      if (dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath(); pts.forEach(function (p, j) { if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
      ctx.restore();
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* tiles */
      for (var r = 0; r < spec.rows; r++) for (var c = 0; c < spec.cols; c++) {
        var k = c + "," + r, us = res.usage[k] || 0;
        ctx.fillStyle = us ? heatColor(us / spec.cap) : "#fdfdfd"; ctx.fillRect(PAD + c * CELL, PAD + r * CELL, CELL - 1, CELL - 1);
        ctx.strokeStyle = "rgba(120,125,135,0.25)"; ctx.lineWidth = 0.5; ctx.strokeRect(PAD + c * CELL, PAD + r * CELL, CELL - 1, CELL - 1);
      }
      /* hovered net's alternate route first (dashed, faint), so the bold routes sit on top */
      if (hover >= 0) drawPath(netPts(hover, 1 - choice[hover]), PAL[hover % PAL.length], 2.2, true, 0.4);
      /* non-hovered nets (dimmed if something is hovered), then the hovered one bold */
      spec.nets.forEach(function (n, i) { if (i === hover) return; drawPath(netPts(i), PAL[i % PAL.length], 3, false, hover >= 0 ? 0.25 : 0.65); });
      if (hover >= 0) drawPath(netPts(hover), PAL[hover % PAL.length], 4.5, false, 1);
      /* endpoints + net labels */
      spec.nets.forEach(function (n, i) {
        var s = tc(n.s[0] + "," + n.s[1]), d = tc(n.d[0] + "," + n.d[1]), col = PAL[i % PAL.length];
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.lineJoin = "round";
        ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.strokeText(n.id, s.x, s.y - 7); ctx.fillStyle = col; ctx.fillText(n.id, s.x, s.y - 7);
      });
      /* congestion counts LAST, with a white halo so they stay readable over the wires */
      ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      for (var r2 = 0; r2 < spec.rows; r2++) for (var c2 = 0; c2 < spec.cols; c2++) {
        var k2 = c2 + "," + r2, u2 = res.usage[k2] || 0; if (!u2) continue;
        var tx = PAD + (c2 + 0.5) * CELL, ty = PAD + (r2 + 0.5) * CELL, over = u2 > spec.cap, label = u2 + "/" + spec.cap;
        ctx.lineWidth = 3.5; ctx.strokeStyle = "#fff"; ctx.strokeText(label, tx, ty);
        ctx.fillStyle = over ? "#dc2626" : "#3b414d"; ctx.fillText(label, tx, ty);
      }
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(PAD, PAD, spec.cols * CELL, spec.rows * CELL);
    }
    function computeScore(res) {
      var total = Math.max(4000, Math.min(10000, Math.round(res.pass ? (10000 - (res.peak - 1) * 400) : 4000))), best = total;
      try { var key = "mp-best-" + (spec.id || "route-global"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">No tile over capacity</span><span class="mp-detail">' + (res.overflow.length ? res.overflow.length + " tiles over" : "peak " + res.peak + "/" + spec.cap) + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Routable. Lower peak congestion scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>No tile over capacity.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Find a red tile, then hover the nets crossing it and switch one to its other route (dashed) so it detours around the jam.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choice); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function distToSeg(px, py, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; var t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0; var qx = a.x + t * dx, qy = a.y + t * dy; return Math.hypot(px - qx, py - qy); }
    function nearestNet(px, py) { var bn = -1, bd = 12; spec.nets.forEach(function (n, i) { var pts = netPts(i); for (var j = 0; j + 1 < pts.length; j++) { var d = distToSeg(px, py, pts[j], pts[j + 1]); if (d < bd) { bd = d; bn = i; } } }); return bn; }
    function pos(e) { var r0 = canvas.getBoundingClientRect(); return [(e.touches ? e.touches[0].clientX : e.clientX) - r0.left, (e.touches ? e.touches[0].clientY : e.clientY) - r0.top]; }
    canvas.addEventListener("mousemove", function (e) { var p = pos(e), h = nearestNet(p[0], p[1]); if (h !== hover) { hover = h; draw(last); } canvas.style.cursor = h >= 0 ? "pointer" : "default"; });
    canvas.addEventListener("mouseleave", function () { if (hover !== -1) { hover = -1; draw(last); } });
    function tap(e) { var p = pos(e), h = nearestNet(p[0], p[1]); if (h >= 0) { choice[h] = 1 - choice[h]; scoreObj = null; hover = h; refresh(); } e.preventDefault(); }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { choice = spec.start.slice(); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.GRoute = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
