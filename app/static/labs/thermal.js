/* Thermal-aware placement lab. Each block dissipates power and heats the die
   around it; the temperature at a point is the ambient plus every block's
   contribution, so clustering hot blocks builds a hotspot. Keep the peak
   temperature under the limit (spread the hot blocks) while keeping the
   critical nets short (connected blocks close). When two hot blocks are wired
   together you are squeezed: too close overheats, too far fails timing.
   window.Thermal = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.55, 0.1 + 0.4 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }
  function tempAt(spec, blocks, x, y) {
    var t = spec.ambient, s2 = 2 * spec.sigma * spec.sigma;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], dx = x - (b.x + b.w / 2), dy = y - (b.y + b.h / 2);
      t += b.power * Math.exp(-(dx * dx + dy * dy) / s2);
    }
    return t;
  }
  function evaluate(spec, blocks) {
    var core = spec.core, halo = spec.halo || 3, S = spec.sampleGrid || 28;
    var byId = {}; blocks.forEach(function (b) { byId[b.id] = b; });
    var oob = [], ov = [];
    blocks.forEach(function (b) { if (b.x < -1e-6 || b.y < -1e-6 || b.x + b.w > core.w + 1e-6 || b.y + b.h > core.h + 1e-6) oob.push(b.id); });
    for (var i = 0; i < blocks.length; i++) for (var j = i + 1; j < blocks.length; j++) {
      var a = blocks[i], c = blocks[j];
      if (a.x - halo < c.x + c.w && c.x < a.x + a.w + halo && a.y - halo < c.y + c.h && c.y < a.y + a.h + halo) ov.push([a.id, c.id]);
    }
    var peak = 0, px = 0, py = 0;
    for (var gy = 0; gy <= S; gy++) for (var gx = 0; gx <= S; gx++) {
      var x = gx / S * core.w, y = gy / S * core.h, t = tempAt(spec, blocks, x, y);
      if (t > peak) { peak = t; px = x; py = y; }
    }
    var crit = (spec.nets || []).filter(function (n) { return n.critical; }).map(function (n) {
      var xs = [], ys = [];
      n.terminals.forEach(function (tt) { var m = byId[tt.block]; xs.push(m.x + m.w / 2); ys.push(m.y + m.h / 2); });
      var len = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
      return { id: n.id, len: len, budget: n.budget, ok: len <= n.budget + 1e-6 };
    });
    var legal = oob.length === 0 && ov.length === 0;
    var thermalOK = peak <= spec.tMax + 1e-6;
    var timingMet = crit.every(function (c) { return c.ok; });
    return { oob: oob, ov: ov, peak: peak, peakX: px, peakY: py, crit: crit, legal: legal, thermalOK: thermalOK, timingMet: timingMet, pass: legal && thermalOK && timingMet };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var G = spec.grid || 48;
    var state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id, power: b.power }; });
    var pMax = Math.max.apply(null, state.map(function (b) { return b.power; }));
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">temperature map (ambient ' + spec.ambient + '°, limit ' + spec.tMax + '°)</span><span class="mp-legend-bar"></span><span class="mp-legend-ends"><span>cool</span><span>at limit</span><span>over</span></span>';
    left.appendChild(legend);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      var tw = core.w / G, th = core.h / G, span = spec.tMax - spec.ambient;
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var x = (gx + 0.5) * tw, y = (gy + 0.5) * th;
        ctx.fillStyle = heatColor((tempAt(spec, state, x, y) - spec.ambient) / span);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      var byId = {}; state.forEach(function (b) { byId[b.id] = b; });
      (spec.nets || []).forEach(function (n) {
        var pts = n.terminals.map(function (t) { var m = byId[t.block]; return [m.x + m.w / 2, m.y + m.h / 2]; });
        var critOk = res && res.crit.filter(function (c) { return c.id === n.id; })[0];
        ctx.strokeStyle = n.critical ? (res ? (critOk && critOk.ok ? "rgba(21,128,61,0.85)" : "rgba(220,38,38,0.85)") : "rgba(71,85,105,0.7)") : "rgba(90,96,110,0.28)";
        ctx.lineWidth = n.critical ? 2 : 1;
        for (var i = 1; i < pts.length; i++) { ctx.beginPath(); ctx.moveTo(mx(pts[0][0]), my(pts[0][1])); ctx.lineTo(mx(pts[i][0]), my(pts[i][1])); ctx.stroke(); }
      });
      state.forEach(function (b) {
        var hot = b.power / pMax, X = mx(b.x), Y = my(b.y), Wp = b.w * sc, Hp = b.h * sc;
        var bad = res && (res.oob.indexOf(b.id) >= 0 || res.ov.some(function (o) { return o[0] === b.id || o[1] === b.id; }));
        /* fill tinted by the block's own power: cool blue -> hot red */
        ctx.fillStyle = bad ? "rgba(220,38,38,0.25)" : "hsla(" + (210 - 200 * hot).toFixed(0) + ",70%,55%,0.4)";
        ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = bad ? "#dc2626" : (hot > 0.6 ? "#c23c32" : "#2f6fed"); ctx.lineWidth = 2; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.label, X + Wp / 2, Y + Hp / 2 - 4);
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = hot > 0.6 ? "#c23c32" : "#4b5059"; ctx.fillText(b.power + " mW", X + Wp / 2, Y + Hp / 2 + 8);
        ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
      if (res && !res.thermalOK) { ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx(res.peakX), my(res.peakY), 7, 0, Math.PI * 2); ctx.stroke(); }
    }

    function computeScore(res) {
      var thermMargin = Math.max(0, Math.min(1, (spec.tMax - res.peak) / (spec.tMax - spec.ambient)));
      var total = Math.round(4000 + 6000 * thermMargin);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "thermal"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best, peak: Math.round(res.peak) };
    }
    function row(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Peak temperature under limit", res.thermalOK, res.peak.toFixed(0) + "° / " + spec.tMax + "°");
      html += row("Timing closes", res.timingMet, res.crit.filter(function (c) { return c.ok; }).length + " / " + res.crit.length + " nets");
      html += row("Legality", res.legal, res.legal ? "in bounds, no overlap" : (res.oob.length ? res.oob.length + " out of bounds; " : "") + (res.ov.length ? res.ov.length + " overlap" : ""));
      html += '<div class="mp-crit-head">critical nets</div>';
      res.crit.forEach(function (c) { html += '<div class="mp-crit ' + (c.ok ? "mp-ok" : "mp-bad") + '">' + c.id + ': ' + c.len.toFixed(0) + ' / ' + c.budget + '</div>'; });
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Cool and timed. More thermal headroom scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under the limit and timed.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Spread the high-power blocks apart to cool the hotspot (red crosshair), but keep blocks joined by a bold net close enough to meet timing.</span></div>';
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, state); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; } return null; }
    function down(e) { var p = pt(e), m = pick(p); if (m) { drag = { m: m, dx: p[0] - m.x, dy: p[1] - m.y }; scoreObj = null; e.preventDefault(); } }
    function move(e) { if (!drag) return; var p = pt(e), m = drag.m; m.x = Math.max(0, Math.min(core.w - m.w, p[0] - drag.dx)); m.y = Math.max(0, Math.min(core.h - m.h, p[1] - drag.dy)); refresh(); e.preventDefault(); }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id, power: b.power }; }); scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Thermal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
