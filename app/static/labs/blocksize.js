/* Block sizing lab. Before placement you choose the block's geometry: the
   UTILIZATION (how densely to pack a fixed cell area) and the ASPECT ratio.
   Utilization sets the core area (coreArea = cellArea / util); aspect sets
   width x height. Three budgets pull against each other:
   - area   : coreArea <= areaMax          (a smaller, cheaper die wants HIGH util)
   - routing: util * aspectPenalty <= cap   (dense/skewed congests -> wants LOW util, square)
   - timing : (w + h) <= wireBudget         (long wires fail -> wants a SMALL, square die)
   The sweet spot is util just under the routing cap at a near-square aspect.
   window.BlockSize = { evaluate, mount }. */
(function () {
  "use strict";

  function derive(spec, p) {
    var coreArea = spec.cellArea / p.util;
    var w = Math.sqrt(coreArea * p.aspect), h = Math.sqrt(coreArea / p.aspect);
    var aspectPenalty = (p.aspect + 1 / p.aspect) / 2;   /* 1 at square, grows with skew */
    return { coreArea: coreArea, w: w, h: h, aspectPenalty: aspectPenalty, wire: w + h };
  }

  function evaluate(spec, p) {
    var d = derive(spec, p);
    var cong = p.util * d.aspectPenalty;
    var areaOK = d.coreArea <= spec.areaMax + 1e-6;
    var routeOK = cong <= spec.routableCap + 1e-6;
    var timeOK = d.wire <= spec.wireBudget + 1e-6;
    return {
      coreArea: d.coreArea, w: d.w, h: d.h, wire: d.wire, cong: cong, util: p.util, aspect: p.aspect,
      areaOK: areaOK, routeOK: routeOK, timeOK: timeOK, pass: areaOK && routeOK && timeOK
    };
  }

  function mount(container, spec) {
    var PAD = 24, MAXPX = 360, refMax = spec.refMax || 150;
    var sc = MAXPX / refMax;
    var W = MAXPX + PAD * 2, Hpx = MAXPX + PAD * 2;
    var cx = W / 2, cy = Hpx / 2;

    var params = { util: spec.util.default, aspect: spec.aspect.default };
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
    wrap.appendChild(left);

    var panel = document.createElement("div"); panel.className = "mp-panel";
    wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var Wp = res.w * sc, Hp = res.h * sc, x0 = cx - Wp / 2, y0 = cy - Hp / 2;
      /* the core rectangle: its size and shape change with util and aspect */
      var overCong = res.cong > spec.routableCap, overArea = res.coreArea > spec.areaMax;
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(x0, y0, Wp, Hp);
      /* standard-cell fabric: cells share the row height but have varied
         widths (like real gates); the fill density tracks utilization */
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, Wp, Hp); ctx.clip();
      var rowH = 7 * sc, u = Math.max(0.15, params.util);
      var seed = 1234; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      ctx.fillStyle = overCong ? "rgba(220,38,38,0.42)" : "rgba(37,99,235,0.34)";
      ctx.strokeStyle = overCong ? "rgba(150,20,20,0.5)" : "rgba(23,60,150,0.4)"; ctx.lineWidth = 0.5;
      for (var y = y0 + 2; y < y0 + Hp - 2; y += rowH) {
        for (var x = x0 + 2; x < x0 + Wp - 3;) {
          var cw = (3 + rnd() * 6) * sc;                      /* varied cell widths */
          if (x + cw > x0 + Wp - 2) cw = x0 + Wp - 2 - x;
          if (cw < 1.5) break;
          ctx.fillRect(x, y, cw, rowH - 2); ctx.strokeRect(x, y, cw, rowH - 2);
          x += cw / u;                                        /* gap shrinks as utilization rises */
        }
      }
      ctx.restore();
      /* area-budget reference outline (the biggest allowed square die) */
      var refSide = Math.sqrt(spec.areaMax) * sc;
      ctx.strokeStyle = "rgba(120,125,135,0.6)"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
      ctx.strokeRect(cx - refSide / 2, cy - refSide / 2, refSide, refSide); ctx.setLineDash([]);
      /* the core outline, red if any check the geometry drives is violated */
      ctx.strokeStyle = (overCong || overArea || res.wire > spec.wireBudget) ? "#dc2626" : "#15803d";
      ctx.lineWidth = 2.4; ctx.strokeRect(x0, y0, Wp, Hp);
      ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#4b5059"; ctx.textAlign = "left";
      ctx.fillText(res.w.toFixed(0) + " x " + res.h.toFixed(0), x0, y0 - 6);
      /* live utilization at the top-right of the box */
      ctx.textAlign = "right"; ctx.font = "800 13px 'JetBrains Mono', monospace";
      ctx.fillStyle = overCong ? "#dc2626" : "#15803d";
      ctx.fillText((res.util * 100).toFixed(0) + "% util", x0 + Wp, y0 - 6);
      ctx.save(); ctx.translate(x0 - 8, cy); ctx.rotate(-Math.PI / 2);
      ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#4b5059"; ctx.textAlign = "center";
      ctx.fillText("dashed = area budget", 0, 0); ctx.restore();
    }

    function computeScore(res) {
      /* reward the smallest routable die (highest util) at a square aspect */
      var utilEff = Math.max(0, Math.min(1, (res.util - 0.6) / (spec.routableCap - 0.6)));
      var sq = Math.max(0, 1 - Math.abs(Math.log(res.aspect)) / Math.log(2));
      var total = Math.round(2500 + 4500 * utilEff + 3000 * sq);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "block"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best, util: Math.round(res.util * 100) };
    }
    function row(label, ok, detail) {
      return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>';
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Fits the area budget", res.areaOK, res.coreArea.toFixed(0) + " / " + spec.areaMax + " units²");
      html += row("Routable", res.routeOK, "congestion " + (res.cong * 100).toFixed(0) + "% / " + (spec.routableCap * 100).toFixed(0) + "% max");
      html += row("Timing closes", res.timeOK, "wire " + res.wire.toFixed(0) + " / " + spec.wireBudget);
      html += '<div class="mp-crit-head">geometry</div>';
      html += '<div class="mp-crit">utilization ' + (res.util * 100).toFixed(0) + '% &middot; aspect ' + res.aspect.toFixed(2) + '</div>';
      html += '<div class="mp-crit">core ' + res.w.toFixed(0) + ' x ' + res.h.toFixed(0) + ' = ' + res.coreArea.toFixed(0) + ' units² (cell area ' + spec.cellArea + ')</div>';
      if (res.pass) {
        if (scoreObj) {
          html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' +
            '<div class="mp-score-line">utilization ' + scoreObj.util + '%</div>' +
            (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') +
            '<div class="mp-flow-note">All budgets met. Push utilization higher (smaller die) and keep it square for a higher score.</div></div>';
        } else html += '<div class="mp-flow mp-flow-ready"><b>All budgets met.</b> Click <b>Submit design</b> to score it.</div>';
      } else {
        html += '<div class="mp-score"><span class="mp-score-note">Pack tighter (raise utilization) to shrink the die for area and timing, but too dense or too skewed will not route. Aim square.</span></div>';
      }
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, params); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }

    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    var defs = [["util", spec.util, function (v) { return (v * 100).toFixed(0) + " %"; }], ["aspect", spec.aspect, function (v) { return v.toFixed(2) + " (w:h)"; }]];
    defs.forEach(function (df) {
      var key = df[0], cfg = df[1], fmt = df[2];
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range";
      input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = params[key];
      function show() { val.textContent = fmt(+input.value); } show();
      input.addEventListener("input", function () { params[key] = +input.value; scoreObj = null; show(); refresh(); });
      lab.textContent = cfg.label; lab.appendChild(val); wrapEl.appendChild(lab); wrapEl.appendChild(input); ctrls.appendChild(wrapEl);
    });
    left.insertBefore(ctrls, canvas.nextSibling);
    left.appendChild(ctrls);

    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bSubmit); btnRow.appendChild(bReset);
    left.appendChild(btnRow);

    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () {
      params = { util: spec.util.default, aspect: spec.aspect.default }; scoreObj = null;
      ctrls.querySelectorAll("input").forEach(function (inp, i) { inp.value = params[defs[i][0]]; inp.dispatchEvent(new Event("input")); });
    });

    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.BlockSize = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
