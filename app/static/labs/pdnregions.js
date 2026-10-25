/* Regional power-grid sizing lab. The die is split into power regions, each
   with its own current draw and its own IR (current times resistance) drop
   budget. The learner sets a per-region mesh density (plus a global ring) so
   every region meets its own budget while its signal routing still closes.
   A hot, budget-tight region needs a dense local mesh; a cool but
   routing-heavy region must stay lean, so a single uniform mesh cannot win.
   window.PDNRegions = { evaluate, mount }.

   Per region r with density d_r and ring width wRing:
   - IR peak  : ringK/wRing + coreK * J_r / d_r
   - blockage : d_r  (mesh coverage in that region)
   - routing  : closes when (1 - d_r) * openFrac >= demand_r */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }

  function evaluate(spec, params) {
    var of = spec.openFrac || 0.85;
    var regions = spec.regions.map(function (r) {
      var d = params.d[r.id];
      var irPeak = spec.ringK / params.ring + spec.coreK * r.J / d;
      var cap = (1 - Math.min(0.95, d)) * of;
      var util = r.demand / Math.max(1e-6, cap);
      return {
        id: r.id, label: r.label, x: r.x, y: r.y, w: r.w, h: r.h,
        J: r.J, budget: r.budget, demand: r.demand,
        d: d, irPeak: irPeak, blockage: d, cap: cap, util: util,
        irOK: irPeak <= r.budget + 1e-6, routes: util <= 1 + 1e-6
      };
    });
    var irOK = regions.every(function (r) { return r.irOK; });
    var routesAll = regions.every(function (r) { return r.routes; });
    return { regions: regions, irOK: irOK, routesAll: routesAll };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 440;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }
    var G = spec.grid || 48;

    var params = { ring: spec.ring.default, d: {} };
    spec.regions.forEach(function (r) { params.d[r.id] = spec.density.default; });
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
      '<span class="mp-legend-title">IR-drop map (per region, vs its own budget)</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>low</span><span>at budget</span><span>over</span></span>';
    left.appendChild(legend);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    function regionAt(res, x, y) {
      for (var i = 0; i < res.regions.length; i++) { var r = res.regions[i]; if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r; }
      return res.regions[0];
    }
    function ringPed() { return spec.ringK / params.ring; }

    function drawRouting(res) {
      var seed = 40507; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      res.regions.forEach(function (r) {
        var n = 22, failFrac = r.routes ? 0 : (1 - 1 / r.util);
        for (var i = 0; i < n; i++) {
          var bad = (i / n) >= (1 - failFrac);
          var horiz = rnd() < 0.5;
          if (horiz) {
            var y = r.y + rnd() * r.h, x0 = r.x + rnd() * r.w * 0.5, x1 = Math.min(r.x + r.w, x0 + 6 + rnd() * r.w * 0.5);
            if (x1 - x0 < 3) continue;
            ctx.strokeStyle = bad ? "rgba(220,38,38,0.85)" : "rgba(13,148,136,0.55)"; ctx.lineWidth = bad ? 1.6 : 1;
            if (bad) ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(mx(x0), my(y)); ctx.lineTo(mx(x1), my(y)); ctx.stroke(); ctx.setLineDash([]);
          } else {
            var x = r.x + rnd() * r.w, y0 = r.y + rnd() * r.h * 0.5, y1 = Math.min(r.y + r.h, y0 + 6 + rnd() * r.h * 0.5);
            if (y1 - y0 < 3) continue;
            ctx.strokeStyle = bad ? "rgba(220,38,38,0.85)" : "rgba(13,148,136,0.55)"; ctx.lineWidth = bad ? 1.6 : 1;
            if (bad) ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(mx(x), my(y0)); ctx.lineTo(mx(x), my(y1)); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      });
    }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      var tw = core.w / G, th = core.h / G, ped = ringPed();
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var cx = (gx + 0.5) * tw, cy = (gy + 0.5) * th, r = regionAt(res, cx, cy);
        /* gentle bowl within the region: worst toward the region centre */
        var u = (cx - r.x) / r.w, v = (cy - r.y) / r.h;
        var shape = 0.55 + 0.45 * (1 - Math.pow(2 * u - 1, 2)) * (1 - Math.pow(2 * v - 1, 2));
        var drop = ped + spec.coreK * r.J / r.d * shape;
        ctx.fillStyle = heatColor(drop / r.budget);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      if (routed) drawRouting(routed);
      /* per-region mesh stripes: denser where density is higher */
      res.regions.forEach(function (r) {
        var pitch = Math.max(4, 22 - r.d * 40);      /* higher density -> tighter pitch (visual) */
        var swpx = Math.max(1, (0.4 + r.d * 3) * sc * 0.4);
        ctx.save(); ctx.beginPath(); ctx.rect(mx(r.x), my(r.y), r.w * sc, r.h * sc); ctx.clip();
        ctx.strokeStyle = "rgba(37,99,235,0.5)"; ctx.lineWidth = swpx;
        for (var x = r.x + pitch / 2; x < r.x + r.w; x += pitch) { ctx.beginPath(); ctx.moveTo(mx(x), my(r.y)); ctx.lineTo(mx(x), my(r.y + r.h)); ctx.stroke(); }
        for (var y = r.y + pitch / 2; y < r.y + r.h; y += pitch) { ctx.beginPath(); ctx.moveTo(mx(r.x), my(y)); ctx.lineTo(mx(r.x + r.w), my(y)); ctx.stroke(); }
        ctx.restore();
      });
      /* power ring */
      var rpx = Math.max(3, params.ring * sc * 0.7);
      ctx.strokeStyle = "rgba(21,128,61,0.85)"; ctx.lineWidth = rpx;
      ctx.strokeRect(mx(0) + rpx / 2, my(0) + rpx / 2, core.w * sc - rpx, core.h * sc - rpx);
      /* region separators + labels */
      res.regions.forEach(function (r) {
        var bad = !r.irOK || (routed && !r.routes);
        ctx.strokeStyle = bad ? "rgba(220,38,38,0.9)" : "rgba(26,29,38,0.55)";
        ctx.lineWidth = bad ? 2.2 : 1.2; ctx.setLineDash([5, 3]);
        ctx.strokeRect(mx(r.x) + 1, my(r.y) + 1, r.w * sc - 2, r.h * sc - 2); ctx.setLineDash([]);
        ctx.fillStyle = "#1a1d26"; ctx.textAlign = "center";
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillText(r.label, mx(r.x + r.w / 2), my(r.y) + 14);
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#4b5059";
        ctx.fillText("I=" + r.J.toFixed(1) + "x  ≤" + r.budget + "mV", mx(r.x + r.w / 2), my(r.y) + 26);
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var irHead = 1, rtHead = 1;
      res.regions.forEach(function (r) {
        irHead = Math.min(irHead, Math.max(0, (r.budget - r.irPeak) / 18));
        rtHead = Math.min(rtHead, Math.max(0, (1 - r.util) / 0.15));
      });
      var total = Math.round(4000 + 3000 * Math.min(1, irHead) + 3000 * Math.min(1, rtHead));
      var best = total;
      try {
        var key = "mp-best-" + (spec.id || "pdnreg");
        var prev = parseInt(window.localStorage.getItem(key) || "0", 10);
        best = Math.max(prev, total); window.localStorage.setItem(key, String(best));
      } catch (e) { /* private mode */ }
      return { total: total, best: best };
    }

    function regRow(r) {
      var ok = r.irOK && (!routed || r.routes);
      var routeTxt = routed ? (r.routes ? ", routes " + (r.util * 100).toFixed(0) + "%" : ", ROUTING FAILS " + (r.util * 100).toFixed(0) + "%") : "";
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + r.label + '</span><span class="mp-detail">' + r.irPeak.toFixed(0) + "/" + r.budget + "mV" + routeTxt + '</span></div>';
    }
    function render(res) {
      var pass = res.irOK && routed && res.routesAll;
      var html = '<div class="mp-verdict ' + (pass ? "mp-pass" : "mp-fail") + '">' + (pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-crit-head">per-region IR drop' + (routed ? " and routing" : "") + '</div>';
      res.regions.forEach(function (r) { html += regRow(r); });
      if (scoreObj) {
        html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
          (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
          '<div class="mp-flow-note">Every region meets its own budget and routes. Trim the over-served regions for a higher score.</div></div>';
      } else if (routed && res.routesAll && res.irOK) {
        html += '<div class="mp-flow mp-flow-ready"><b>All regions closed.</b> Click <b>Submit design</b> to score it.</div>';
      } else if (routed && !res.routesAll) {
        html += '<div class="mp-flow mp-flow-routed" style="color:var(--red)"><b>Routing failed in a region.</b> A region\'s mesh is too dense for its signals: lower that region\'s density (and lean on the ring), then re-run Place &amp; Route.</div>';
      } else if (!res.irOK) {
        html += '<div class="mp-score"><span class="mp-score-note">Give the hot, tight-budget regions more density; the cool regions need little. Widen the ring to help every region at once.</span></div>';
      } else {
        html += '<div class="mp-flow mp-flow-ready"><b>All budgets met.</b> Run <b>Place & Route</b> to check every region\'s routing fits.</div>';
      }
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() {
      last = evaluate(spec, params);
      draw(last); render(last);
      bRoute.disabled = !last.irOK; bRoute.classList.toggle("mp-ready", last.irOK && !routed);
      bSubmit.disabled = !(last.irOK && routed && last.routesAll);
      bSubmit.classList.toggle("mp-ready", last.irOK && routed && last.routesAll);
    }

    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    function slider(getVal, setVal, cfg, label) {
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = getVal();
      function show() { val.textContent = (+input.value).toFixed(cfg.step < 1 ? 2 : 0) + " " + (cfg.unit || ""); }
      show();
      input.addEventListener("input", function () { setVal(+input.value); routed = null; scoreObj = null; show(); refresh(); });
      lab.textContent = label; lab.appendChild(val);
      wrapEl.appendChild(lab); wrapEl.appendChild(input); wrapEl._input = input;
      return wrapEl;
    }
    var ringSlider = slider(function () { return params.ring; }, function (v) { params.ring = v; }, spec.ring, "Power ring width");
    ctrls.appendChild(ringSlider);
    var regSliders = spec.regions.map(function (r) {
      var s = slider(function () { return params.d[r.id]; }, function (v) { params.d[r.id] = v; }, spec.density, r.label + " mesh density");
      ctrls.appendChild(s); return s;
    });
    left.insertBefore(ctrls, legend);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bRoute = document.createElement("button"); bRoute.className = "btn mp-route"; bRoute.textContent = "Place & Route";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bRoute); btnRow.appendChild(bSubmit); btnRow.appendChild(bReset);
    left.appendChild(btnRow);

    bRoute.addEventListener("click", function () { if (last && last.irOK) { routed = last; scoreObj = null; refresh(); } });
    bSubmit.addEventListener("click", function () { if (last && last.irOK && routed && last.routesAll) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () {
      params = { ring: spec.ring.default, d: {} };
      spec.regions.forEach(function (r) { params.d[r.id] = spec.density.default; });
      routed = null; scoreObj = null;
      ringSlider._input.value = params.ring; ringSlider._input.dispatchEvent(new Event("input"));
    });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PDNRegions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
