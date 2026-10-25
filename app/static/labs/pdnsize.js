/* Power-ring and mesh sizing lab. No tools, no licenses: the learner sizes the
   power delivery network (ring width, stripe width, stripe pitch) with sliders,
   a transparent analytical model scores static IR (current times resistance)
   drop, and a Place & Route step checks whether the signal routing still closes
   once the mesh and the macros have eaten their share of the tracks.
   window.PDN = { evaluate, mount }.

   Model (units are abstract but the trends are faithful):
   - global mesh drop : globalK / blockage  (a sparse mesh droops the centre)
   - local drop       : localK * pitch^2     (ripple midway between stripes)
   - ring pedestal    : ringK / ringWidth     (current first crosses the ring)
   - blockage         : stripeWidth / pitch   (mesh metal coverage on the layers)
   - routing capacity : (1 - blockage) * openFraction, where openFraction is the
     die area left after the macros. Signal routing closes when the design's
     routing demand fits that capacity.
   Cutting IR drop forces a denser mesh (more blockage), which cuts routing
   capacity, and the macros cut it further, so the two budgets pull apart. */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }

  function openFraction(spec) {
    var A = spec.core.w * spec.core.h, M = 0;
    (spec.macros || []).forEach(function (m) { M += m.w * m.h; });
    return Math.max(0.05, (A - M) / A);
  }

  function evaluate(spec, p) {
    var blockage = p.stripeW / p.pitch;                 /* mesh coverage on the routing layers */
    var globalPeak = spec.globalK / blockage;
    var localPeak = spec.localK * p.pitch * p.pitch;
    var ringPedestal = spec.ringK / p.ring;
    var peakIR = ringPedestal + globalPeak + localPeak;
    var irOK = peakIR <= spec.irBudget + 1e-6;
    var fOpen = openFraction(spec);
    var capacity = (1 - Math.min(0.95, blockage)) * fOpen;
    var util = spec.routingDemand / Math.max(1e-6, capacity);
    var routes = util <= 1 + 1e-6;
    return {
      peakIR: peakIR, blockage: blockage,
      globalPeak: globalPeak, localPeak: localPeak, ringPedestal: ringPedestal,
      fOpen: fOpen, capacity: capacity, util: util, routes: routes,
      irOK: irOK
    };
  }

  function fieldAt(spec, p, res, u, v) {
    var shape = (1 - Math.pow(2 * u - 1, 2)) * (1 - Math.pow(2 * v - 1, 2));
    var L = spec.core.w, half = p.pitch / 2;
    var dx = Math.abs(((u * L) % p.pitch) - half), dy = Math.abs(((v * L) % p.pitch) - half);
    var d = Math.min(dx, dy);
    return res.ringPedestal + res.globalPeak * shape + res.localPeak * Math.pow(d / half, 2);
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 430;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }
    var G = spec.grid || 40;

    var params = { ring: spec.ring.default, stripeW: spec.stripeW.default, pitch: spec.pitch.default };
    var routed = null;     /* result of the last Place & Route on the current sliders */
    var scoreObj = null;

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
      '<span class="mp-legend-title">IR-drop map (voltage droop)</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>low</span><span>at budget</span><span>over</span></span>';
    left.appendChild(legend);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    function drawMacro(m, routeState) {
      var X = mx(m.x), Y = my(m.y), Wp = m.w * sc, Hp = m.h * sc;
      ctx.fillStyle = "#e7e4db"; ctx.fillRect(X, Y, Wp, Hp);
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Wp, Hp); ctx.clip();
      ctx.strokeStyle = "rgba(120,125,135,0.5)"; ctx.lineWidth = 1; ctx.beginPath();
      for (var d = 0; d < Wp + Hp; d += 7) { ctx.moveTo(X + d, Y); ctx.lineTo(X + d - Hp, Y + Hp); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = "#7b8089"; ctx.lineWidth = 1.6; ctx.strokeRect(X, Y, Wp, Hp);
      ctx.fillStyle = "#4b5059"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(m.label || m.id, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
    }

    /* representative signal routing revealed by Place & Route: thin traces in
       the open channels around the macros. When the design over-uses the
       tracks (util > 1) the overflow fraction is drawn red as unrouted nets. */
    function drawRouting(res) {
      var seed = 98765; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      var N = 60, failFrac = res.routes ? 0 : (1 - 1 / res.util);
      for (var i = 0; i < N; i++) {
        var bad = (i / N) >= (1 - failFrac);
        var horiz = rnd() < 0.5;
        var a = rnd() * (horiz ? core.h : core.w);          /* fixed coord of the trace */
        var s = rnd() * (horiz ? core.w : core.h) * 0.7;    /* start along the trace */
        var e = Math.min(horiz ? core.w : core.h, s + 10 + rnd() * 46);
        /* clip the trace before it crosses a macro */
        (spec.macros || []).forEach(function (m) {
          if (horiz) { if (a >= m.y && a <= m.y + m.h) { if (s < m.x && e > m.x) e = Math.min(e, m.x - 1); else if (s >= m.x && s <= m.x + m.w) s = m.x + m.w + 1; } }
          else { if (a >= m.x && a <= m.x + m.w) { if (s < m.y && e > m.y) e = Math.min(e, m.y - 1); else if (s >= m.y && s <= m.y + m.h) s = m.y + m.h + 1; } }
        });
        if (e - s < 4) continue;
        ctx.strokeStyle = bad ? "rgba(220,38,38,0.85)" : "rgba(13,148,136,0.6)";
        ctx.lineWidth = bad ? 1.6 : 1;
        if (bad) ctx.setLineDash([3, 3]);
        ctx.beginPath();
        if (horiz) { ctx.moveTo(mx(s), my(a)); ctx.lineTo(mx(e), my(a)); }
        else { ctx.moveTo(mx(a), my(s)); ctx.lineTo(mx(a), my(e)); }
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      var tw = core.w / G, th = core.h / G;
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var u = (gx + 0.5) / G, v = (gy + 0.5) / G;
        ctx.fillStyle = heatColor(fieldAt(spec, params, res, u, v) / spec.irBudget);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      /* signal routing (only after Place & Route) - drawn under the mesh/macros */
      if (routed) drawRouting(routed);
      /* power ring: a solid band around the core, thicker as ring width grows */
      var rpx = Math.max(3, params.ring * sc);
      ctx.fillStyle = "rgba(21,128,61,0.9)";
      ctx.fillRect(mx(0), my(0), core.w * sc, rpx);                          /* top */
      ctx.fillRect(mx(0), my(core.h) - rpx, core.w * sc, rpx);               /* bottom */
      ctx.fillRect(mx(0), my(0), rpx, core.h * sc);                          /* left */
      ctx.fillRect(mx(core.w) - rpx, my(0), rpx, core.h * sc);               /* right */
      /* mesh stripes: solid metal bars, drawn at their true width so widening
         the stripe visibly fattens them */
      var swpx = Math.max(2, params.stripeW * sc);
      ctx.fillStyle = "rgba(37,99,235,0.72)";
      for (var x = params.pitch / 2; x < core.w; x += params.pitch) { ctx.fillRect(mx(x) - swpx / 2, my(0), swpx, core.h * sc); }
      for (var y = params.pitch / 2; y < core.h; y += params.pitch) { ctx.fillRect(mx(0), my(y) - swpx / 2, core.w * sc, swpx); }
      /* macros on top (they block signal routing over their footprint) */
      (spec.macros || []).forEach(function (m) { drawMacro(m); });
      /* die border, tinted by the last routing result */
      var bc = routed ? (routed.routes ? "#15803d" : "#dc2626") : "#1a1d26";
      ctx.strokeStyle = bc; ctx.lineWidth = routed ? 2.6 : 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var irHead = Math.max(0, Math.min(1, (spec.irBudget - res.peakIR) / 20));
      var rtHead = Math.max(0, Math.min(1, (1 - res.util) / 0.18));
      var total = Math.round(4000 + 3000 * irHead + 3000 * rtHead);
      var best = total;
      try {
        var key = "mp-best-" + (spec.id || "pdn");
        var prev = parseInt(window.localStorage.getItem(key) || "0", 10);
        best = Math.max(prev, total); window.localStorage.setItem(key, String(best));
      } catch (e) { /* private mode */ }
      return { total: total, best: best, irMargin: Math.round(spec.irBudget - res.peakIR), util: Math.round(res.util * 100) };
    }

    function row(label, ok, detail) {
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function render(res) {
      var irDetail = res.peakIR.toFixed(0) + " / " + spec.irBudget + " mV";
      var pass = res.irOK && routed && routed.routes;
      var html = '<div class="mp-verdict ' + (pass ? "mp-pass" : "mp-fail") + '">' + (pass ? "PASS" : "not yet") + '</div>';
      html += row("Static IR drop under budget", res.irOK, irDetail);
      /* routing row: pending until Place & Route is run on the current mesh */
      if (!routed) {
        html += '<div class="mp-row"><span class="mp-mark">•</span><span class="mp-label">Signal routing closes</span>' +
          '<span class="mp-detail">run Place &amp; Route</span></div>';
      } else {
        html += row("Signal routing closes", routed.routes, (routed.util * 100).toFixed(0) + "% of tracks used" + (routed.routes ? "" : " (over 100%)"));
      }
      html += '<div class="mp-crit-head">where the IR drop comes from</div>';
      html += '<div class="mp-crit">ring pedestal: ' + res.ringPedestal.toFixed(0) + ' mV</div>';
      html += '<div class="mp-crit">mesh (centre bowl): ' + res.globalPeak.toFixed(0) + ' mV</div>';
      html += '<div class="mp-crit">local (between stripes): ' + res.localPeak.toFixed(0) + ' mV</div>';
      html += '<div class="mp-crit-head">routing budget</div>';
      html += '<div class="mp-crit">mesh blockage ' + (res.blockage * 100).toFixed(0) + '% &middot; macros ' + ((1 - res.fOpen) * 100).toFixed(0) + '% &middot; capacity ' + (res.capacity * 100).toFixed(0) + '%</div>';

      if (scoreObj) {
        html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
          '<div class="mp-score-line">IR margin &middot; ' + scoreObj.irMargin + ' mV</div>' +
          '<div class="mp-score-line">routing used &middot; ' + scoreObj.util + '%</div>' +
          (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
          '<div class="mp-flow-note">Both budgets met. Trim the mesh for more routing headroom, or tighten it for more IR margin.</div></div>';
      } else if (routed && routed.routes && res.irOK) {
        html += '<div class="mp-flow mp-flow-ready"><b>Routing closed.</b> Click <b>Submit design</b> to score it.</div>';
      } else if (routed && !routed.routes) {
        html += '<div class="mp-flow mp-flow-routed" style="color:var(--red)"><b>Routing failed to close.</b> The mesh is eating too many tracks: widen the pitch or thin the stripes, then re-run Place &amp; Route.</div>';
      } else if (!res.irOK) {
        html += '<div class="mp-score"><span class="mp-score-note">Widen the ring or the stripes and tighten the pitch to pull the centre out of the red.</span></div>';
      } else {
        html += '<div class="mp-flow mp-flow-ready"><b>IR drop met.</b> Run <b>Place &amp; Route</b> to check the signal routing still fits.</div>';
      }
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() {
      last = evaluate(spec, params);
      draw(last); render(last);
      bRoute.disabled = !last.irOK;
      bRoute.classList.toggle("mp-ready", last.irOK && !routed);
      bSubmit.disabled = !(last.irOK && routed && routed.routes);
      bSubmit.classList.toggle("mp-ready", last.irOK && routed && routed.routes);
    }

    /* sliders */
    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    var keys = ["ring", "stripeW", "pitch"];
    function slider(key, cfg, label) {
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = params[key];
      function show() { val.textContent = (+input.value).toFixed(cfg.step < 1 ? 1 : 0) + " " + (cfg.unit || ""); }
      show();
      input.addEventListener("input", function () { params[key] = +input.value; routed = null; scoreObj = null; show(); refresh(); });
      lab.textContent = label; lab.appendChild(val);
      wrapEl.appendChild(lab); wrapEl.appendChild(input);
      return wrapEl;
    }
    ctrls.appendChild(slider("ring", spec.ring, "Power ring width"));
    ctrls.appendChild(slider("stripeW", spec.stripeW, "Stripe width"));
    ctrls.appendChild(slider("pitch", spec.pitch, "Stripe pitch"));
    left.insertBefore(ctrls, legend);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bRoute = document.createElement("button"); bRoute.className = "btn mp-route"; bRoute.textContent = "Place & Route";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bRoute); btnRow.appendChild(bSubmit); btnRow.appendChild(bReset);
    left.appendChild(btnRow);

    bRoute.addEventListener("click", function () { if (last && last.irOK) { routed = last; scoreObj = null; refresh(); } });
    bSubmit.addEventListener("click", function () { if (last && last.irOK && routed && routed.routes) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () {
      params = { ring: spec.ring.default, stripeW: spec.stripeW.default, pitch: spec.pitch.default };
      routed = null; scoreObj = null;
      ctrls.querySelectorAll("input").forEach(function (inp, i) { inp.value = params[keys[i]]; inp.dispatchEvent(new Event("input")); });
    });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PDN = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
