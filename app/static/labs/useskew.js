/* Useful-skew lab. Three flip-flops A -> B -> C with combinational logic on each
   hop. Path A->B fails setup. Intentionally skewing B's clock (delaying it)
   borrows time: setup A->B improves as B captures later, but the same later
   clock launches B->C later (hurting its setup) and moves B's capture edge
   (hurting hold A->B). Slide the skew into the window where all four setup/hold
   checks are positive. slack_i = base_i + coef_i * skew.
   window.UseSkew = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, delta) {
    var slacks = spec.checks.map(function (c) { return c.base + c.coef * delta; });
    var min = Math.min.apply(null, slacks);
    return { slacks: slacks, min: min, pass: min >= -1e-9 };
  }
  function mount(container, spec) {
    var W = 480, Hpx = 210, PAD = 20;
    var delta = spec.deltaStart, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    /* skew slider */
    var sl = document.createElement("div"); sl.className = "pdn-controls";
    var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
    var lab = document.createElement("label"); lab.className = "pdn-slider-label";
    var val = document.createElement("span"); val.className = "pdn-slider-val";
    var input = document.createElement("input"); input.type = "range"; input.min = spec.deltaMin; input.max = spec.deltaMax; input.step = spec.deltaStep; input.value = delta;
    lab.textContent = "B clock skew"; lab.appendChild(val); wrapEl.appendChild(lab); wrapEl.appendChild(input); sl.appendChild(wrapEl); left.appendChild(sl);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function ff(x, y, id, skewed) {
      ctx.fillStyle = skewed ? "rgba(217,119,6,0.2)" : "rgba(13,148,136,0.18)"; ctx.fillRect(x - 16, y - 20, 32, 40);
      ctx.strokeStyle = skewed ? "#d97706" : "#0d9488"; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y - 20, 32, 40);
      ctx.fillStyle = skewed ? "#d97706" : "#0d9488"; ctx.beginPath(); ctx.moveTo(x - 16, y + 20); ctx.lineTo(x - 16, y + 12); ctx.lineTo(x - 8, y + 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#134e4a"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(id, x, y - 2);
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(PAD, PAD, W - 2 * PAD, Hpx - 2 * PAD);
      var y = 74, xa = 70, xb = 240, xc = 410;
      /* data paths (combi clouds) */
      [[xa, xb, res.slacks[0]], [xb, xc, res.slacks[2]]].forEach(function (seg) {
        ctx.strokeStyle = "rgba(90,96,110,0.5)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(seg[0] + 16, y); ctx.lineTo(seg[1] - 16, y); ctx.stroke();
        var mxs = (seg[0] + seg[1]) / 2;
        ctx.fillStyle = "rgba(120,125,135,0.12)"; ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(mxs, y, 26, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#5a606e"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("logic", mxs, y);
      });
      ff(xa, y, "A", false); ff(xb, y, "B", true); ff(xc, y, "C", false);
      /* clock lines from a common clock, with a skew element on B */
      var cy = 150, cxRoot = 240;
      ctx.strokeStyle = "#2a5cc8"; ctx.lineWidth = 1.4;
      [xa, xb, xc].forEach(function (x) { ctx.beginPath(); ctx.moveTo(cxRoot, cy); ctx.lineTo(x, cy); ctx.lineTo(x, y + 22); ctx.stroke(); });
      ctx.fillStyle = "#2a5cc8"; ctx.beginPath(); ctx.arc(cxRoot, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a5cc8"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("clock", cxRoot, cy + 14);
      /* skew element on B's clock leg */
      ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(xb - 6, cy - 22); ctx.lineTo(xb + 6, cy - 16); ctx.lineTo(xb - 6, cy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#7c3a06"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("skew " + (delta >= 0 ? "+" : "") + delta.toFixed(1), xb + 10, cy - 16);
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(PAD, PAD, W - 2 * PAD, Hpx - 2 * PAD);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, res.min / 0.6));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-useskew"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      spec.checks.forEach(function (c, i) {
        var s = res.slacks[i], ok = s >= -1e-9;
        html += '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + c.label + ' (' + c.kind + ')</span><span class="mp-detail">' + (s >= 0 ? "+" : "") + s.toFixed(1) + ' ns</span></div>';
      });
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">worst slack: <b>' + (res.min >= 0 ? "+" : "") + res.min.toFixed(1) + '</b> ns</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">In the useful-skew window. Aim for the centre for the most margin against variation.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All four checks positive.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { val.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(1) + " ns"; last = evaluate(spec, delta); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    input.addEventListener("input", function () { delta = +input.value; scoreObj = null; refresh(); });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { delta = spec.deltaStart; input.value = delta; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.UseSkew = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
