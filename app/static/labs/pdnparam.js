/* Parametric power-grid sizing lab, two models selected by spec.model:
   - "rail": size the standard-cell power rails (rail width, strap pitch) so the
     local IR (current times resistance) drop from a cell to the mesh stays
     under budget while the M1 (metal-1) routing still closes.
   - "em": size the power stripes and via arrays so the current density stays
     under the electromigration limit, without over-blocking the routing.
   window.PDNParam = { evaluate, mount }. */
(function () {
  "use strict";

  function heatColor(r) {
    var rr = Math.max(0, r);
    var hue = 130 * (1 - Math.min(1, rr));
    var light = rr > 1 ? Math.max(42, 52 - (rr - 1) * 16) : 52;
    var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr));
    return "hsla(" + hue.toFixed(0) + ",72%," + light.toFixed(0) + "%," + a.toFixed(2) + ")";
  }
  function openFrac(spec) { return spec.openFrac || 0.85; }

  function evalRail(spec, p) {
    /* the row height (rail pitch) and rail width are fixed by the library.
       The knobs are how often the mesh straps drop vias to the rails
       (strapPitch) and how many vias per drop (viaCount).
       local IR = mesh drop + M1 rail travel (~ strapPitch^2 at fixed rail
       width) + via-stack drop (~ 1/viaCount). */
    var ir = spec.meshFixed + spec.railK * p.strapPitch * p.strapPitch + spec.viaK / p.viaCount;
    var blockage = Math.min(0.95, spec.strapCov / p.strapPitch + p.viaCount * spec.viaCov);
    var util = spec.demand / Math.max(1e-6, (1 - blockage) * openFrac(spec));
    return {
      ir: ir, blockage: blockage, util: util,
      metrics: [
        { label: "Local IR drop", value: ir, limit: spec.irBudget, unit: " mV", ok: ir <= spec.irBudget + 1e-6 },
        { label: "Routing closes", value: util * 100, limit: 100, unit: "%", ok: util <= 1 + 1e-6 }
      ],
      pass: ir <= spec.irBudget + 1e-6 && util <= 1 + 1e-6
    };
  }
  function evalEM(spec, p) {
    /* current density = branch current / its width, per level of the grid.
       The trunk carries the most current, the leaves the least, so each level
       needs its own width. Total metal (all stripes) sets routing blockage. */
    var jt = spec.trunkI / p.trunkW, jm = spec.midI / p.midW, jl = spec.leafI / p.leafW;
    var metal = p.trunkW * spec.nTrunk + p.midW * spec.nMid + p.leafW * spec.nLeaf;
    var blockage = Math.min(0.95, metal * spec.covPerW);
    var util = spec.demand / Math.max(1e-6, (1 - blockage) * openFrac(spec));
    return {
      jt: jt, jm: jm, jl: jl, blockage: blockage, util: util,
      metrics: [
        { label: "Trunk current density", value: jt, limit: spec.jMax, unit: "", ok: jt <= spec.jMax + 1e-6 },
        { label: "Branch current density", value: jm, limit: spec.jMax, unit: "", ok: jm <= spec.jMax + 1e-6 },
        { label: "Leaf current density", value: jl, limit: spec.jMax, unit: "", ok: jl <= spec.jMax + 1e-6 },
        { label: "Routing closes", value: util * 100, limit: 100, unit: "%", ok: util <= 1 + 1e-6 }
      ],
      pass: jt <= spec.jMax + 1e-6 && jm <= spec.jMax + 1e-6 && jl <= spec.jMax + 1e-6 && util <= 1 + 1e-6
    };
  }
  function evaluate(spec, p) { return spec.model === "em" ? evalEM(spec, p) : evalRail(spec, p); }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 430;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; }
    function my(y) { return PAD + y * sc; }
    var G = spec.grid || 40;

    var params = {}; spec.sliders.forEach(function (s) { params[s.key] = s.default; });
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
      '<span class="mp-legend-title">' + (spec.mapLabel || "map") + '</span>' +
      '<span class="mp-legend-bar"></span>' +
      '<span class="mp-legend-ends"><span>safe</span><span>at limit</span><span>over</span></span>';
    left.appendChild(legend);
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    function drawRail(res) {
      var tw = core.w / G, th = core.h / G, half = params.strapPitch / 2;
      var pedestal = spec.meshFixed + spec.viaK / params.viaCount;   /* uniform: mesh + via-stack drop */
      var ripple = Math.max(0, res.ir - pedestal);                   /* rail travel: worst midway between straps */
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var x = (gx + 0.5) * tw;
        var d = Math.abs((x % params.strapPitch) - half);
        var drop = pedestal + ripple * Math.pow(d / half, 2);
        ctx.fillStyle = heatColor(drop / spec.irBudget);
        ctx.fillRect(mx(gx * tw), my(gy * th), tw * sc + 0.7, th * sc + 0.7);
      }
      var rowH = spec.rowHeight || 10;
      /* standard cells: empty rectangles sitting in each row, so the rows are
         tangible. Outline only, so the IR-drop map shows through. */
      ctx.strokeStyle = "rgba(70,80,95,0.4)"; ctx.lineWidth = 0.8;
      var cs = 7; function crnd() { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; }
      for (var ry = 0; ry + rowH <= core.h + 0.01; ry += rowH) {
        var cxu = 2;
        while (cxu < core.w - 3) {
          var cw = 4 + Math.floor(crnd() * 4) * 2;                 /* 4..10 wide cells */
          if (cxu + cw > core.w - 2) cw = core.w - 2 - cxu;
          if (cw < 2) break;
          ctx.strokeRect(mx(cxu), my(ry + 1.4), cw * sc, (rowH - 2.8) * sc);
          cxu += cw + 1.6;
        }
      }
      /* follow-pin power rails: fixed at the row boundaries, alternating VDD /
         VSS the way abutted standard-cell rows share their rails. Labelled in
         the left margin so it is clear what they are. */
      ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textBaseline = "middle";
      for (var bi = 0, yb = 0; yb <= core.h + 0.01; yb += rowH, bi++) {
        var vdd = (bi % 2 === 0);
        ctx.strokeStyle = vdd ? "rgba(198,60,50,0.95)" : "rgba(42,92,200,0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(mx(0), my(yb)); ctx.lineTo(mx(core.w), my(yb)); ctx.stroke();
        ctx.fillStyle = vdd ? "#c23c32" : "#2a5cc8"; ctx.textAlign = "left";
        ctx.fillText(vdd ? "VDD" : "VSS", 1, my(yb));
      }
      /* mesh straps (vertical): the upper-metal power straps, drawn much wider
         than the follow-pin rails, dropping a via array onto each rail. */
      for (var sx = params.strapPitch / 2; sx < core.w; sx += params.strapPitch) {
        ctx.strokeStyle = "rgba(45,50,66,0.72)"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(mx(sx), my(0)); ctx.lineTo(mx(sx), my(core.h)); ctx.stroke();
        ctx.fillStyle = "#15803d";
        for (var y2 = rowH; y2 < core.h - 0.01; y2 += rowH) {
          for (var vk = 0; vk < params.viaCount; vk++) { ctx.beginPath(); ctx.arc(mx(sx) - (params.viaCount - 1) * 1.4 + vk * 2.8, my(y2), 1.1, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      /* label the first strap so its role is clear */
      ctx.fillStyle = "#2d3242"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("mesh strap", mx(params.strapPitch / 2), my(0) - 6);
    }
    function drawEM(res) {
      ctx.fillStyle = "#f6f5f0"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* the grid hierarchy: one trunk, two branches, four leaves. Each bar's
         width is its slider; its colour is that level's current density. */
      var levels = [
        { x: core.w * 0.14, w: params.leafW, j: res.jl }, { x: core.w * 0.36, w: params.leafW, j: res.jl },
        { x: core.w * 0.64, w: params.leafW, j: res.jl }, { x: core.w * 0.86, w: params.leafW, j: res.jl },
        { x: core.w * 0.30, w: params.midW, j: res.jm }, { x: core.w * 0.70, w: params.midW, j: res.jm },
        { x: core.w * 0.50, w: params.trunkW, j: res.jt }
      ];
      levels.forEach(function (L) {
        var ratio = L.j / spec.jMax, half = Math.max(1.2, L.w * sc / 2), x0 = mx(L.x) - half;
        ctx.fillStyle = ratio > 1 ? "rgba(220,38,38,0.45)" : "rgba(21,128,61,0.34)";
        ctx.fillRect(x0, my(6), half * 2, (core.h - 12) * sc);
        ctx.strokeStyle = ratio > 1 ? "#dc2626" : "#15803d"; ctx.lineWidth = 1.2;
        ctx.strokeRect(x0, my(6), half * 2, (core.h - 12) * sc);
      });
      /* per-level current-density readout */
      ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      var rows = [["trunk", res.jt], ["branch", res.jm], ["leaf", res.jl]];
      rows.forEach(function (r, i) {
        ctx.fillStyle = r[1] > spec.jMax ? "#dc2626" : "#15803d";
        ctx.fillText(r[0] + " J=" + r[1].toFixed(1) + "/" + spec.jMax, mx(core.w * (0.2 + i * 0.3)), my(core.h) - 5);
      });
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      if (spec.model === "em") drawEM(res); else drawRail(res);
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var head = 1;
      res.metrics.forEach(function (m) {
        var h = m.limit > 0 ? (m.limit - m.value) / m.limit : 0;
        head = Math.min(head, Math.max(0, h));
      });
      var total = Math.round(4000 + 6000 * Math.min(1, head / 0.5));
      var best = total;
      try {
        var key = "mp-best-" + (spec.id || "param");
        var prev = parseInt(window.localStorage.getItem(key) || "0", 10);
        best = Math.max(prev, total); window.localStorage.setItem(key, String(best));
      } catch (e) { /* private mode */ }
      return { total: total, best: best };
    }

    function row(m) {
      var v = m.unit === "%" ? m.value.toFixed(0) : (Math.abs(m.value) >= 10 ? m.value.toFixed(0) : m.value.toFixed(2));
      var lim = m.unit === "%" ? m.limit : (m.limit >= 10 ? m.limit : m.limit.toFixed(2));
      var detail = m.unit === "%" ? v + "% / " + lim + "%" : v + " / " + lim + m.unit;
      return '<div class="mp-row ' + (m.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (m.ok ? "✔" : "✗") +
        '</span><span class="mp-label">' + m.label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      res.metrics.forEach(function (m) { html += row(m); });
      if (spec.hint) html += '<div class="mp-crit-head">note</div><div class="mp-crit">' + spec.hint + '</div>';
      if (res.pass) {
        if (scoreObj) {
          html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
            (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
            '<div class="mp-flow-note">All budgets met. Trim the metal for a higher score.</div></div>';
        } else html += '<div class="mp-flow mp-flow-ready"><b>All budgets met.</b> Click <b>Submit design</b> to score it.</div>';
      } else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.failNote || "Adjust the sliders to bring every row green.") + '</span></div>';
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, params); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }

    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    spec.sliders.forEach(function (cfg) {
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = params[cfg.key];
      function show() { val.textContent = (+input.value).toFixed(cfg.step < 1 ? 1 : 0) + " " + (cfg.unit || ""); }
      show();
      input.addEventListener("input", function () { params[cfg.key] = +input.value; scoreObj = null; show(); refresh(); });
      lab.textContent = cfg.label; lab.appendChild(val);
      wrapEl.appendChild(lab); wrapEl.appendChild(input); ctrls.appendChild(wrapEl);
    });
    left.insertBefore(ctrls, legend);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bSubmit); btnRow.appendChild(bReset);
    left.appendChild(btnRow);

    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () {
      spec.sliders.forEach(function (s) { params[s.key] = s.default; });
      scoreObj = null;
      ctrls.querySelectorAll("input").forEach(function (inp, i) { inp.value = params[spec.sliders[i].key]; inp.dispatchEvent(new Event("input")); });
    });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.PDNParam = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
