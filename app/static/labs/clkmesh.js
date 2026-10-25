/* Clock mesh lab with a NON-UNIFORM clock-load field. The background heat map is
   the clock load: hot (red) regions have heavy switching load and droop badly
   unless a driver sits close; cool regions tolerate being far. Each node's skew
   is load * distance-to-nearest-driver, and the worst node sets the result.
   Click mesh nodes to inject drivers - concentrate them where the load is - and
   spend the fewest that bring the worst droop under target.
   window.ClkMesh = { evaluate, mount }. */
(function () {
  "use strict";
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function field(spec, x, y) {
    var v = spec.base;
    spec.hotspots.forEach(function (h) { var d2 = (x - h.x) * (x - h.x) + (y - h.y) * (y - h.y); v += h.amp * Math.exp(-d2 / (2 * h.sigma * h.sigma)); });
    return v;
  }
  function loadHeat(r) {   // 0 (cool) -> 1 (hot): pale blue-grey to red
    var rr = Math.max(0, Math.min(1, r));
    var hue = 210 - 210 * rr, sat = 20 + 60 * rr, light = 88 - 34 * rr;
    return "hsl(" + hue.toFixed(0) + "," + sat.toFixed(0) + "%," + light.toFixed(0) + "%)";
  }
  function evaluate(spec, drivers) {
    if (!drivers.length) return { droops: spec.nodes.map(function () { return Infinity; }), worst: Infinity, drivers: 0, skewOK: false, drvOK: true, pass: false };
    var droops = spec.nodes.map(function (n) { var d = Math.min.apply(null, drivers.map(function (di) { return man(n, spec.nodes[di]); })); return n.load * d; });
    var worst = Math.max.apply(null, droops);
    return { droops: droops, worst: worst, drivers: drivers.length,
      skewOK: worst <= spec.target + 1e-6, drvOK: drivers.length <= spec.maxDrivers,
      pass: worst <= spec.target + 1e-6 && drivers.length <= spec.maxDrivers };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 24, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var drivers = [], scoreObj = null;
    var uxs = []; spec.nodes.forEach(function (n) { if (uxs.indexOf(n.x) < 0) uxs.push(n.x); }); uxs.sort(function (a, b) { return a - b; });
    var uys = []; spec.nodes.forEach(function (n) { if (uys.indexOf(n.y) < 0) uys.push(n.y); }); uys.sort(function (a, b) { return a - b; });
    var peak = spec.base; spec.hotspots.forEach(function (h) { peak += h.amp; });   // normalization for the load heat

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">clock load (demand)</span><span class="mp-legend-bar" style="background:linear-gradient(90deg,hsl(210,20%,88%),hsl(0,80%,54%))"></span><span class="mp-legend-ends"><span>light</span><span>heavy</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Background = clock load. A node's ring shows its droop (load x distance to nearest driver); red rings are over the limit. Click a node to place/remove a driver.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* load heat-map background */
      var TX = 44, TY = 34, tw = core.w / TX, th = core.h / TY;
      for (var gy = 0; gy < TY; gy++) for (var gx = 0; gx < TX; gx++) {
        var lx = (gx + 0.5) * tw, ly = (gy + 0.5) * th;
        ctx.fillStyle = loadHeat(field(spec, lx, ly) / peak);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      /* mesh wires */
      ctx.strokeStyle = "rgba(42,92,200,0.28)"; ctx.lineWidth = 1.2;
      uys.forEach(function (y) { ctx.beginPath(); ctx.moveTo(mx(uxs[0]), my(y)); ctx.lineTo(mx(uxs[uxs.length - 1]), my(y)); ctx.stroke(); });
      uxs.forEach(function (x) { ctx.beginPath(); ctx.moveTo(mx(x), my(uys[0])); ctx.lineTo(mx(x), my(uys[uys.length - 1])); ctx.stroke(); });
      /* node rings coloured by droop */
      spec.nodes.forEach(function (n, i) {
        var ratio = res.droops[i] === Infinity ? 1.3 : res.droops[i] / spec.target;
        ctx.beginPath(); ctx.arc(mx(n.x), my(n.y), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fdfdfd"; ctx.fill();
        ctx.strokeStyle = ratio > 1 ? "#dc2626" : "#15803d"; ctx.lineWidth = ratio > 1 ? 2.2 : 1.4; ctx.stroke();
      });
      /* drivers */
      drivers.forEach(function (d) { var n = spec.nodes[d]; ctx.fillStyle = "#1a1d26"; ctx.strokeStyle = "#f5f5f5"; ctx.lineWidth = 1.4; ctx.beginPath(); var R = 7; ctx.moveTo(mx(n.x), my(n.y) - R); ctx.lineTo(mx(n.x) + R, my(n.y)); ctx.lineTo(mx(n.x), my(n.y) + R); ctx.lineTo(mx(n.x) - R, my(n.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.maxDrivers - res.drivers) / Math.max(1, spec.maxDrivers - spec.driverPar + 1)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-mesh"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Worst droop (load x distance) under target", res.skewOK, (res.worst === Infinity ? "no drivers" : res.worst.toFixed(0)) + " / " + spec.target);
      html += rowc("Drivers within power budget", res.drvOK, res.drivers + " / " + spec.maxDrivers);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Drivers concentrated on the load, fewer overall. A mesh trades power for low skew and robustness.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Worst droop met within the power budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, drivers); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < spec.nodes.length; i++) { var n = spec.nodes[i]; if (Math.abs(px - mx(n.x)) < 10 && Math.abs(py - my(n.y)) < 10) { var k = drivers.indexOf(i); if (k >= 0) drivers.splice(k, 1); else drivers.push(i); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { drivers = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkMesh = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
