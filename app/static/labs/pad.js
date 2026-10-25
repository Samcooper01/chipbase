/* Cell-padding-for-routability lab. A row of cells in fixed order is packed
   tight; a cluster of pin-heavy cells makes a local routing hotspot. Click a
   cell to add padding (extra spacing before it), which spreads the cluster and
   lowers the local pin density - but every pad lengthens the wires and pushes
   the row wider. Clear the congestion limit while keeping wirelength under
   target and the row inside the core.
   Model: leftEdge[i] = leftEdge[i-1] + w[i-1] + baseGap + padUnit*pad[i].
   window.Pad = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) {
    var rr = Math.max(0, r), hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.6, 0.16 + 0.4 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }
  function evaluate(spec, pad) {
    var N = spec.cells.length, le = new Array(N), ce = new Array(N);
    le[0] = spec.startX; ce[0] = le[0] + spec.cells[0].w / 2;
    for (var i = 1; i < N; i++) { le[i] = le[i - 1] + spec.cells[i - 1].w + spec.baseGap + spec.padUnit * pad[i]; ce[i] = le[i] + spec.cells[i].w / 2; }
    var rowLen = le[N - 1] + spec.cells[N - 1].w;
    var cellCong = new Array(N), peak = 0;
    for (var k = 0; k < N; k++) {
      var s = 0; for (var j = 0; j < N; j++) if (Math.abs(ce[j] - ce[k]) <= spec.win / 2) s += spec.cells[j].pins;
      cellCong[k] = s / spec.cap; peak = Math.max(peak, cellCong[k]);
    }
    var wl = 0; spec.nets.forEach(function (n) { wl += Math.abs(ce[n[0]] - ce[n[1]]); });
    var congOK = peak <= spec.congLimit + 1e-6, wlOK = wl <= spec.wlTarget + 1e-6, fitOK = rowLen <= spec.coreW + 1e-6;
    return { le: le, ce: ce, rowLen: rowLen, cellCong: cellCong, peak: peak, wl: wl, congOK: congOK, wlOK: wlOK, fitOK: fitOK, pass: congOK && wlOK && fitOK };
  }

  function mount(container, spec) {
    var N = spec.cells.length, PAD = 22, MAXPX = 540;
    var sc = MAXPX / spec.coreW, rowH = spec.rowH || 26;
    var W = spec.coreW * sc + PAD * 2, Hpx = rowH + 120;
    var yTop = PAD + 34;
    var pad = new Array(N).fill(0), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">local pin density</span><span class="mp-legend-bar"></span><span class="mp-legend-ends"><span>routable</span><span>at limit</span><span>congested</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Click a cell to add padding (click again to cycle down). Dots on each cell are its pins. Padding spreads the pins apart but lengthens the wires (grey) and widens the row.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function mx(x) { return PAD + x * sc; }
    var hitboxes = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* core extent */
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), yTop - 6, spec.coreW * sc, rowH + 12);
      ctx.strokeStyle = res.fitOK ? "#1a1d26" : "#dc2626"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), yTop - 6, spec.coreW * sc, rowH + 12);
      ctx.fillStyle = "#9aa0aa"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText("core edge", mx(spec.coreW) - 2, yTop - 9);
      /* nets between cell centers (drawn as low arcs) */
      spec.nets.forEach(function (n) {
        var a = res.ce[n[0]], b = res.ce[n[1]];
        ctx.strokeStyle = "rgba(90,96,110,0.35)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx(a), yTop + rowH); var midx = (a + b) / 2; ctx.quadraticCurveTo(mx(midx), yTop + rowH + 26, mx(b), yTop + rowH); ctx.stroke();
      });
      /* cells */
      hitboxes = [];
      spec.cells.forEach(function (c, i) {
        var X = mx(res.le[i]), Wp = c.w * sc;
        ctx.fillStyle = heatColor(res.cellCong[i] / spec.congLimit); ctx.fillRect(X, yTop, Wp, rowH);
        ctx.strokeStyle = res.cellCong[i] > spec.congLimit ? "#dc2626" : "#2d6a4f"; ctx.lineWidth = 1.4; ctx.strokeRect(X, yTop, Wp, rowH);
        hitboxes.push([X, X + Wp, i]);
        /* pins as dots along the top */
        for (var p = 0; p < c.pins; p++) { var pxp = X + Wp * (p + 1) / (c.pins + 1); ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.arc(pxp, yTop + 4, 1.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(c.id, X + Wp / 2, yTop + rowH / 2 + 2);
        if (pad[i] > 0) { ctx.fillStyle = "#7c3a06"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textBaseline = "alphabetic"; ctx.fillText("+" + pad[i], X + Wp / 2, yTop - 2); }
      });
    }
    function computeScore(res) {
      var head = Math.max(0, (spec.wlTarget - res.wl) / spec.wlTarget);
      var total = Math.round(4000 + 6000 * Math.min(1, head / 0.18)), best = total;
      try { var key = "mp-best-" + (spec.id || "pad"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Local density under limit", res.congOK, (res.peak * 100).toFixed(0) + "% / " + (spec.congLimit * 100).toFixed(0) + "%");
      html += rowc("Wirelength under target", res.wlOK, res.wl.toFixed(0) + " / " + spec.wlTarget);
      html += rowc("Row fits in core", res.fitOK, res.rowLen.toFixed(0) + " / " + spec.coreW);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Routable with the least spreading. Less added wire scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Congestion cleared, still routable and in budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, pad); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), mxp = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, myp = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      if (myp >= yTop && myp <= yTop + rowH) {
        for (var h = 0; h < hitboxes.length; h++) { if (mxp >= hitboxes[h][0] && mxp <= hitboxes[h][1]) { var i = hitboxes[h][2]; if (i >= 1) { pad[i] = (pad[i] + 1) % (spec.maxPad + 1); scoreObj = null; refresh(); } break; } }
      }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { pad = new Array(N).fill(0); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Pad = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
