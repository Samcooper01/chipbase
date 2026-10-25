/* Clock buffer insertion lab. The root drives the whole clock tree, but a
   driver's transition (slew) blows the limit once its downstream load passes
   maxLoad. Click internal hubs to drop buffers: a buffer re-drives everything
   below it, splitting the tree into regions. Every driver's region load must be
   under the limit, with as few buffers as possible.
   window.ClkBuf = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) {
    var rr = Math.max(0, r), hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + Math.min(0.6, 0.2 + 0.4 * Math.min(1.2, rr)).toFixed(2) + ")";
  }
  function evaluate(spec, buffered) {
    var nodes = spec.nodes, children = spec.children, N = nodes.length, bset = {};
    buffered.forEach(function (b) { bset[b] = true; });
    var regionOf = new Array(N).fill(-1);
    function assign(node, driver) { regionOf[node] = driver; children[node].forEach(function (c) { if (!bset[c]) assign(c, driver); }); }
    var drivers = [0].concat(buffered);
    drivers.forEach(function (d) { children[d].forEach(function (c) { if (!bset[c]) assign(c, d); }); regionOf[d] = d; });
    function load(d) {
      var l = nodes[d][2];
      (function rec(node) { children[node].forEach(function (c) { if (bset[c]) l += nodes[c][1] + spec.bufInCap; else { l += nodes[c][1] + nodes[c][2]; rec(c); } }); })(d);
      return l;
    }
    var loadByDriver = {}; drivers.forEach(function (d) { loadByDriver[d] = load(d); });
    var maxRegion = Math.max.apply(null, drivers.map(function (d) { return loadByDriver[d]; }));
    var slewOK = maxRegion <= spec.maxLoad + 1e-6;
    var budgetOK = spec.bufBudget == null || buffered.length <= spec.bufBudget;
    return { regionOf: regionOf, loadByDriver: loadByDriver, drivers: drivers, maxRegion: maxRegion, buffers: buffered.length,
      slewOK: slewOK, budgetOK: budgetOK, pass: slewOK && budgetOK };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 24, MAXPX = 440;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var buffered = [], scoreObj = null;
    function toggle(i) { var k = buffered.indexOf(i); if (k >= 0) buffered.splice(k, 1); else buffered.push(i); }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">region load</span><span class="mp-legend-bar"></span><span class="mp-legend-ends"><span>light</span><span>at limit</span><span>over</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Click a hub (circle) to place or remove a buffer. Squares are flip-flop sinks. Each region is coloured by its driver's load.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var nodes = spec.nodes, children = spec.children;
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* edges coloured by the child's region driver load */
      nodes.forEach(function (n, i) {
        if (n[0] < 0) return; var p = nodes[n[0]];
        var d = res.regionOf[i], ratio = d >= 0 ? res.loadByDriver[d] / spec.maxLoad : 0;
        ctx.strokeStyle = heatColor(ratio); ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(mx(p[3]), my(p[4])); ctx.lineTo(mx(n[3]), my(p[4])); ctx.lineTo(mx(n[3]), my(n[4])); ctx.stroke();
      });
      nodes.forEach(function (n, i) {
        var isLeaf = children[i].length === 0, isBuf = buffered.indexOf(i) >= 0, isRoot = i === 0;
        var X = mx(n[3]), Y = my(n[4]);
        if (isLeaf) { ctx.fillStyle = "rgba(13,148,136,0.2)"; ctx.fillRect(X - 5, Y - 4, 10, 8); ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 1; ctx.strokeRect(X - 5, Y - 4, 10, 8); }
        else if (isRoot) { ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(X, Y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("root", X, Y - 8); }
        else if (isBuf) { ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X - 6, Y - 6); ctx.lineTo(X + 6, Y); ctx.lineTo(X - 6, Y + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else { ctx.fillStyle = "#eef1f5"; ctx.strokeStyle = "#5a606e"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(X, Y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      });
      /* per-driver load labels */
      res.drivers.forEach(function (d) {
        var n = nodes[d], over = res.loadByDriver[d] > spec.maxLoad;
        ctx.fillStyle = over ? "#dc2626" : "#2d6a4f"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(res.loadByDriver[d].toFixed(0), mx(n[3]) + 12, my(n[4]) + 3);
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var par = spec.bufPar || 2, eff = Math.max(0, Math.min(1, (par * 2 - res.buffers) / par));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-buffer"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Every driver under slew load", res.slewOK, "peak " + res.maxRegion.toFixed(0) + " / " + spec.maxLoad);
      if (spec.bufBudget != null) html += rowc("Buffers within budget", res.budgetOK, res.buffers + " / " + spec.bufBudget);
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">buffers used: <b>' + res.buffers + '</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Slew met. Fewer buffers = less clock power and latency.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every driver meets the slew load.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, buffered); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < spec.canBuffer.length; i++) { var n = nodes[spec.canBuffer[i]]; if (Math.abs(px - mx(n[3])) < 12 && Math.abs(py - my(n[4])) < 12) { toggle(spec.canBuffer[i]); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { buffered = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkBuf = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
