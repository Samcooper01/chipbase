/* Non-default-rule (NDR) clock routing lab. The clock trunk runs a long way and
   must arrive clean. Widen the wire to cut its resistance (better transition /
   slew), and add spacing or grounded shield wires to cut coupling from the
   aggressor nets beside it (less crosstalk-induced delay). Both cost routing
   tracks. Meet the slew and crosstalk limits without blowing the track budget.
     slew     = slewK / width
     crosstalk = xtK / (spacing + shieldEff * shield)
     tracks   = width + (spacing - 1) + 2 * shield
   window.ClkNDR = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, p) {
    var slew = spec.slewK / p.width;
    var xtalk = spec.xtK / (p.spacing + spec.shieldEff * p.shield);
    var tracks = p.width + (p.spacing - 1) + 2 * p.shield;
    return {
      slew: slew, xtalk: xtalk, tracks: tracks,
      metrics: [
        { label: "Transition (slew)", value: slew, limit: spec.slewLimit, ok: slew <= spec.slewLimit + 1e-6 },
        { label: "Crosstalk delay", value: xtalk, limit: spec.xtLimit, ok: xtalk <= spec.xtLimit + 1e-6 },
        { label: "Routing tracks used", value: tracks, limit: spec.trackBudget, ok: tracks <= spec.trackBudget + 1e-6 }
      ],
      pass: slew <= spec.slewLimit + 1e-6 && xtalk <= spec.xtLimit + 1e-6 && tracks <= spec.trackBudget + 1e-6
    };
  }
  function mount(container, spec) {
    var W = 480, Hpx = 200, PAD = 20;
    var params = {}; spec.sliders.forEach(function (s) { params[s.key] = s.default; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var ctrls = document.createElement("div"); ctrls.className = "pdn-controls";
    left.appendChild(ctrls);
    var btnRow = document.createElement("div"); btnRow.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    btnRow.appendChild(bSubmit); btnRow.appendChild(bReset); left.appendChild(btnRow); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(PAD, PAD, W - 2 * PAD, Hpx - 2 * PAD);
      var cy = Hpx / 2, x0 = PAD + 30, x1 = W - PAD - 30;
      var gap = 8 + params.spacing * 7;             // visual spacing to aggressors
      /* aggressor signal wires above and below */
      [-1, 1].forEach(function (sgn) {
        ctx.strokeStyle = "rgba(120,125,135,0.7)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, cy + sgn * gap); ctx.lineTo(x1, cy + sgn * gap); ctx.stroke();
        ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("aggressor", x1 - 60, cy + sgn * gap - 6 * sgn);
      });
      /* shield wires (grounded) between clock and aggressors */
      for (var s = 1; s <= params.shield; s++) {
        [-1, 1].forEach(function (sgn) {
          var yy = cy + sgn * gap * s / (params.shield + 1);
          ctx.strokeStyle = "#15803d"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]);
          ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); ctx.setLineDash([]);
        });
      }
      /* clock trunk, thickness = width, colour by slew */
      var slewRatio = res.slew / spec.slewLimit, thick = 2 + params.width * 2.2;
      ctx.strokeStyle = slewRatio > 1 ? "#dc2626" : "#2a5cc8"; ctx.lineWidth = thick;
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
      ctx.fillStyle = "#2a5cc8"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("clock trunk", x0, cy - thick / 2 - 8);
      /* crosstalk arrows if coupling high */
      if (res.xtalk > spec.xtLimit) { ctx.fillStyle = "#dc2626"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("coupling", (x0 + x1) / 2, cy - gap + 10); }
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(PAD, PAD, W - 2 * PAD, Hpx - 2 * PAD);
    }
    function computeScore(res) {
      var slack = Math.min((spec.trackBudget - res.tracks) / spec.trackBudget, 1);
      var total = Math.round(4000 + 6000 * Math.max(0, Math.min(1, slack / 0.4))), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-ndr"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(m) {
      var v = Math.abs(m.value) >= 10 ? m.value.toFixed(0) : m.value.toFixed(2);
      var lim = m.limit >= 10 ? m.limit : m.limit.toFixed(2);
      return '<div class="mp-row ' + (m.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (m.ok ? "✔" : "✗") + '</span><span class="mp-label">' + m.label + '</span><span class="mp-detail">' + v + " / " + lim + '</span></div>';
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      res.metrics.forEach(function (m) { html += row(m); });
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Clean clock within the track budget. Spend the fewest tracks for a higher score.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Slew and crosstalk met, in budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, params); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    spec.sliders.forEach(function (cfg) {
      var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
      var lab = document.createElement("label"); lab.className = "pdn-slider-label";
      var val = document.createElement("span"); val.className = "pdn-slider-val";
      var input = document.createElement("input"); input.type = "range"; input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = params[cfg.key];
      function show() { val.textContent = params[cfg.key] + " " + (cfg.unit || ""); }
      show();
      input.addEventListener("input", function () { params[cfg.key] = +input.value; scoreObj = null; show(); refresh(); });
      lab.textContent = cfg.label; lab.appendChild(val); wrapEl.appendChild(lab); wrapEl.appendChild(input); ctrls.appendChild(wrapEl);
    });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { spec.sliders.forEach(function (s) { params[s.key] = s.default; }); scoreObj = null; ctrls.querySelectorAll("input").forEach(function (inp, i) { inp.value = params[spec.sliders[i].key]; inp.dispatchEvent(new Event("input")); }); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkNDR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
