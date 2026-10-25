/* Multi-layer power-grid closure lab. A static IR (current times resistance)
   drop run flagged a violation over a non-uniform current map. The learner
   sizes the density of a metal STACK to close it:
   - M8 top straps  : coarse, dedicated power metal. Cheap for signal routing,
     carries the global (die-wide) current spreading.
   - M5 mid straps  : finer, but shares layers with signal routing, so its
     density directly eats routing tracks.
   - M1 follow-pin rails: fixed by the library (a constant local term).
   IR at a point = ring pedestal + (a8/d8 + a5/d5) * local current, summing the
   resistance down the stack. The trick: lean on M8 for the global drop and use
   only as much M5 as routing can afford.
   window.PDNStack = { evaluate, mount }. */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }
  function currentAt(spec, x, y) {
    var c = spec.baseCurrent || 0.8;
    (spec.hotspots || []).forEach(function (h) { var dx = x - h.x, dy = y - h.y, s = h.sigma || 22; c += h.mag * Math.exp(-(dx * dx + dy * dy) / (2 * s * s)); });
    return c;
  }
  function stackR(spec, p) { return spec.a8 / p.d8 + spec.a5 / p.d5; }   /* series resistance down the stack, per unit current */
  function irAt(spec, p, x, y) { return spec.ringK / p.ring + stackR(spec, p) * currentAt(spec, x, y); }

  function evaluate(spec, p) {
    var core = spec.core, S = spec.sampleGrid || 28, peak = 0, px = 0, py = 0;
    for (var gy = 0; gy <= S; gy++) for (var gx = 0; gx <= S; gx++) {
      var x = gx / S * core.w, y = gy / S * core.h, v = irAt(spec, p, x, y);
      if (v > peak) { peak = v; px = x; py = y; }
    }
    var blockage = Math.min(0.95, p.d5 * spec.cov5 + p.d8 * spec.cov8);
    var util = spec.demand / Math.max(1e-6, (1 - blockage) * (spec.openFrac || 0.85));
    return {
      peakIR: peak, peakX: px, peakY: py, blockage: blockage, util: util,
      irOK: peak <= spec.irBudget + 1e-6, routes: util <= 1 + 1e-6,
      pass: peak <= spec.irBudget + 1e-6 && util <= 1 + 1e-6
    };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 430;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }
    var G = spec.grid || 48;

    var params = { ring: spec.ring.default, d8: spec.d8.default, d5: spec.d5.default };
    var routed = null, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr;
    canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default";
    var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);

    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML =
      '<span class="mp-legend-title">IR-drop map (over the current map) &middot; M8 vertical, M5 horizontal</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>low</span><span>at budget</span><span>over</span></span>';
    left.appendChild(legend);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      var tw = core.w / G, th = core.h / G;
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var x = (gx + 0.5) * tw, y = (gy + 0.5) * th;
        ctx.fillStyle = heatColor(irAt(spec, params, x, y) / spec.irBudget);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      /* M1 follow-pin rails (fixed, faint horizontal) */
      ctx.strokeStyle = "rgba(90,96,110,0.18)"; ctx.lineWidth = 1;
      for (var yr = 5; yr < core.h; yr += 8) { ctx.beginPath(); ctx.moveTo(mx(0), my(yr)); ctx.lineTo(mx(core.w), my(yr)); ctx.stroke(); }
      /* M5 mid straps (horizontal), density d5 - shares layers with signals */
      var n5 = Math.max(2, Math.round(params.d5 * 46));
      ctx.strokeStyle = "rgba(13,148,136,0.7)"; ctx.lineWidth = 2;
      for (var i5 = 0; i5 < n5; i5++) { var y5 = (i5 + 0.5) * core.h / n5; ctx.beginPath(); ctx.moveTo(mx(0), my(y5)); ctx.lineTo(mx(core.w), my(y5)); ctx.stroke(); }
      /* M8 top straps (vertical), density d8 - coarse, dedicated power metal */
      var n8 = Math.max(2, Math.round(params.d8 * 30));
      ctx.strokeStyle = "rgba(37,60,140,0.72)"; ctx.lineWidth = 5;
      for (var i8 = 0; i8 < n8; i8++) { var x8 = (i8 + 0.5) * core.w / n8; ctx.beginPath(); ctx.moveTo(mx(x8), my(0)); ctx.lineTo(mx(x8), my(core.h)); ctx.stroke(); }
      /* power ring: a solid band around the core, thicker as the ring widens */
      var rpx = Math.max(2, params.ring * sc);
      ctx.fillStyle = "rgba(21,128,61,0.9)";
      ctx.fillRect(mx(0), my(0), core.w * sc, rpx);
      ctx.fillRect(mx(0), my(core.h) - rpx, core.w * sc, rpx);
      ctx.fillRect(mx(0), my(0), rpx, core.h * sc);
      ctx.fillRect(mx(core.w) - rpx, my(0), rpx, core.h * sc);
      /* current hotspots */
      (spec.hotspots || []).forEach(function (h) {
        ctx.strokeStyle = "rgba(180,40,40,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(mx(h.x), my(h.y), (h.sigma || 22) * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      });
      /* worst-droop crosshair when over budget */
      if (res && !res.irOK) {
        ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx(res.peakX), my(res.peakY), 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx(res.peakX) - 8, my(res.peakY)); ctx.lineTo(mx(res.peakX) + 8, my(res.peakY));
        ctx.moveTo(mx(res.peakX), my(res.peakY) - 8); ctx.lineTo(mx(res.peakX), my(res.peakY) + 8); ctx.stroke();
      }
      var bc = routed ? (routed.routes ? "#15803d" : "#dc2626") : "#1a1d26";
      ctx.strokeStyle = bc; ctx.lineWidth = routed ? 2.6 : 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var irHead = Math.max(0, Math.min(1, (spec.irBudget - res.peakIR) / 18));
      var rtHead = Math.max(0, Math.min(1, (1 - res.util) / 0.15));
      var total = Math.round(4000 + 3000 * irHead + 3000 * rtHead);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "stack"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(label, ok, detail) {
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function render(res) {
      var pass = res.irOK && routed && routed.routes;
      var html = '<div class="mp-verdict ' + (pass ? "mp-pass" : "mp-fail") + '">' + (pass ? "PASS" : "not yet") + '</div>';
      html += row("Peak IR drop under budget", res.irOK, res.peakIR.toFixed(0) + " / " + spec.irBudget + " mV");
      if (!routed) html += '<div class="mp-row"><span class="mp-mark">•</span><span class="mp-label">Signal routing closes</span><span class="mp-detail">run Place &amp; Route</span></div>';
      else html += row("Signal routing closes", routed.routes, (routed.util * 100).toFixed(0) + "% of tracks used");
      html += '<div class="mp-crit-head">metal stack</div>';
      html += '<div class="mp-crit">M8 top (global): resistance term ' + (spec.a8 / params.d8).toFixed(0) + '</div>';
      html += '<div class="mp-crit">M5 mid (local): resistance term ' + (spec.a5 / params.d5).toFixed(0) + ', blockage ' + (params.d5 * spec.cov5 * 100).toFixed(0) + '%</div>';
      html += '<div class="mp-crit">ring pedestal: ' + (spec.ringK / params.ring).toFixed(0) + ' mV</div>';
      if (scoreObj) {
        html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
          (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
          '<div class="mp-flow-note">Violation closed and routing fits. Trim M5 for more routing headroom.</div></div>';
      } else if (routed && routed.routes && res.irOK) {
        html += '<div class="mp-flow mp-flow-ready"><b>Closed and routes.</b> Click <b>Submit design</b> to score it.</div>';
      } else if (routed && !routed.routes) {
        html += '<div class="mp-flow mp-flow-routed" style="color:var(--red)"><b>Routing failed.</b> The M5 mesh is eating too many tracks. Lean more on M8 and the ring and thin M5, then re-run Place &amp; Route.</div>';
      } else if (!res.irOK) {
        html += '<div class="mp-score"><span class="mp-score-note">M8 pulls the whole map down cheaply; M5 fixes the local drop at the hotspots but costs routing. Widen the ring too.</span></div>';
      } else {
        html += '<div class="mp-flow mp-flow-ready"><b>IR drop met.</b> Run <b>Place &amp; Route</b> to check the M5 mesh still leaves room for signals.</div>';
      }
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() {
      last = evaluate(spec, params); draw(last); render(last);
      bRoute.disabled = !last.irOK; bRoute.classList.toggle("mp-ready", last.irOK && !routed);
      bSubmit.disabled = !(last.irOK && routed && last.routes); bSubmit.classList.toggle("mp-ready", last.irOK && routed && last.routes);
    }

    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    var defs = [["ring", spec.ring], ["d8", spec.d8], ["d5", spec.d5]];
    defs.forEach(function (df) {
      var key = df[0], cfg = df[1];
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = params[key];
      function show() { val.textContent = (+input.value).toFixed(cfg.step < 1 ? 2 : 0) + " " + (cfg.unit || ""); }
      show();
      input.addEventListener("input", function () { params[key] = +input.value; routed = null; scoreObj = null; show(); refresh(); });
      lab.textContent = cfg.label; lab.appendChild(val);
      wrapEl.appendChild(lab); wrapEl.appendChild(input); wrapEl._input = input; ctrls.appendChild(wrapEl);
    });
    left.insertBefore(ctrls, legend);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bRoute = document.createElement("button"); bRoute.className = "btn mp-route"; bRoute.textContent = "Place & Route";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bRoute); btnRow.appendChild(bSubmit); btnRow.appendChild(bReset);
    left.appendChild(btnRow);

    bRoute.addEventListener("click", function () { if (last && last.irOK) { routed = last; scoreObj = null; refresh(); } });
    bSubmit.addEventListener("click", function () { if (last && last.irOK && routed && last.routes) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () {
      params = { ring: spec.ring.default, d8: spec.d8.default, d5: spec.d5.default }; routed = null; scoreObj = null;
      ctrls.querySelectorAll("input").forEach(function (inp, i) { inp.value = params[defs[i][0]]; inp.dispatchEvent(new Event("input")); });
    });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PDNStack = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
