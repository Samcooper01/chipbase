/* Design-rule-clean routing lab. Parallel wires in a channel violate the
   minimum-spacing rule, and one sits on a routing blockage. Drag each wire
   sideways so every neighbouring gap is at least the minimum spacing, no wire
   overlaps the blockage, and all stay inside the channel.
   window.DRCRoute = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, xs) {
    var ws = spec.wires.map(function (w, i) { return { i: i, x: xs[i], w: w.w }; });
    var order = ws.slice().sort(function (a, b) { return a.x - b.x; });
    var spaceViol = [], blockViol = [], oobViol = [];
    for (var k = 0; k + 1 < order.length; k++) {
      var gap = (order[k + 1].x - order[k + 1].w / 2) - (order[k].x + order[k].w / 2);
      if (gap < spec.minSpace - 1e-9) { spaceViol.push([order[k].i, order[k + 1].i]); }
    }
    ws.forEach(function (w) {
      var l = w.x - w.w / 2, r = w.x + w.w / 2;
      if (l < -1e-9 || r > spec.channel + 1e-9) oobViol.push(w.i);
      if (l < spec.blockage.x1 - 1e-9 && spec.blockage.x0 < r - 1e-9) blockViol.push(w.i);
    });
    return { spaceViol: spaceViol, blockViol: blockViol, oobViol: oobViol,
      spaceOK: spaceViol.length === 0, drcOK: blockViol.length === 0 && oobViol.length === 0,
      pass: spaceViol.length === 0 && blockViol.length === 0 && oobViol.length === 0 };
  }
  function mount(container, spec) {
    var PAD = 24, chH = 300, W = 520, Hpx = chH + PAD * 2 + 10;
    var sc = (W - 2 * PAD) / spec.channel;
    var xs = spec.wires.map(function (w) { return w.x; }), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "ew-resize"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Drag a wire left or right. Red gaps are too tight (under the minimum spacing); a wire on the grey blockage or off the channel edge is a violation.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function mx(x) { return PAD + x * sc; } var y0 = PAD, y1 = PAD + chH;
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), y0, spec.channel * sc, chH);
      /* blockage */
      ctx.fillStyle = "rgba(120,125,135,0.55)"; ctx.fillRect(mx(spec.blockage.x0), y0, (spec.blockage.x1 - spec.blockage.x0) * sc, chH);
      ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("blockage", mx((spec.blockage.x0 + spec.blockage.x1) / 2), y0 + 4);
      var bad = {}; res.blockViol.concat(res.oobViol).forEach(function (i) { bad[i] = true; });
      /* spacing-violation shading between the offending pair */
      res.spaceViol.forEach(function (pr) {
        var a = spec.wires[pr[0]], b = spec.wires[pr[1]], ax = xs[pr[0]] + a.w / 2, bx = xs[pr[1]] - b.w / 2;
        var lo = Math.min(ax, bx), hi = Math.max(ax, bx);
        ctx.fillStyle = "rgba(220,38,38,0.25)"; ctx.fillRect(mx(lo), y0, (hi - lo) * sc, chH);
      });
      spec.wires.forEach(function (w, i) {
        var x = mx(xs[i]) - (w.w * sc) / 2, ww = w.w * sc;
        ctx.fillStyle = bad[i] ? "rgba(220,38,38,0.4)" : "rgba(37,99,237,0.4)"; ctx.fillRect(x, y0, ww, chH);
        ctx.strokeStyle = bad[i] ? "#dc2626" : "#2f6fed"; ctx.lineWidth = 1.6; ctx.strokeRect(x, y0, ww, chH);
        ctx.save(); ctx.translate(mx(xs[i]), (y0 + y1) / 2); ctx.fillStyle = "#1a1d26"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(w.id, 0, 0); ctx.restore();
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), y0, spec.channel * sc, chH);
    }
    function computeScore(res) {
      var minGap = Infinity; var order = spec.wires.map(function (w, i) { return { x: xs[i], w: w.w }; }).sort(function (a, b) { return a.x - b.x; });
      for (var k = 0; k + 1 < order.length; k++) minGap = Math.min(minGap, (order[k + 1].x - order[k + 1].w / 2) - (order[k].x + order[k].w / 2));
      var eff = Math.max(0, Math.min(1, (minGap - spec.minSpace) / spec.minSpace));
      var total = Math.round(5000 + 5000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "route-drc"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Minimum spacing met", res.spaceOK, res.spaceOK ? "all gaps ok" : res.spaceViol.length + " too tight");
      html += rowc("No blockage / edge violation", res.drcOK, res.drcOK ? "clear" : (res.blockViol.length + res.oobViol.length) + " violating");
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">DRC clean. Extra spacing margin scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All design rules met.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, xs); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = -1;
    function px2x(e) { var r0 = canvas.getBoundingClientRect(); return ((e.touches ? e.touches[0].clientX : e.clientX) - r0.left - PAD) / sc; }
    function down(e) { var x = px2x(e); var bd = 5, bi = -1; spec.wires.forEach(function (w, i) { var d = Math.abs(x - xs[i]); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) { drag = bi; e.preventDefault(); } }
    function move(e) { if (drag < 0) return; var x = px2x(e), w = spec.wires[drag].w; xs[drag] = Math.max(w / 2, Math.min(spec.channel - w / 2, x)); scoreObj = null; refresh(); e.preventDefault(); }
    function up() { drag = -1; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { xs = spec.wires.map(function (w) { return w.x; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.DRCRoute = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
