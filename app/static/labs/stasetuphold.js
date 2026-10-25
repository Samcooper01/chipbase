/* STA: setup and hold. A flip-flop needs its data late enough (hold: not before
   thold after the launch edge) and early enough (setup: before the next capture
   edge minus setup). Drag the data-path delay into the window where both slacks
   are non-negative. window.StaSetupHold = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, d) {
    var setup = (spec.period - spec.tsetup) - (spec.tcq + d);
    var hold = (spec.tcq + d) - spec.thold;
    return { d: d, setup: setup, hold: hold, setupOK: setup >= -1e-9, holdOK: hold >= -1e-9,
      floor: spec.thold - spec.tcq, ceil: spec.period - spec.tsetup - spec.tcq,
      pass: setup >= -1e-9 && hold >= -1e-9 };
  }
  function mount(container, spec) {
    var PAD = 24, W = 640, Hpx = 270, axisY = 120;
    var d = spec.dStart, scoreObj = null;
    var span = spec.period * 1.12;
    var x0 = PAD + 20, sc = (W - x0 - PAD - 20) / span;
    function tx(t) { return x0 + t * sc; }
    var clkTopY = 190, clkBotY = 230;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var slc = document.createElement("div"); slc.className = "pdn-controls";
    var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
    var lab = document.createElement("label"); lab.className = "pdn-slider-label"; var val = document.createElement("span"); val.className = "pdn-slider-val";
    var input = document.createElement("input"); input.type = "range"; input.min = spec.dMin; input.max = spec.dMax; input.step = spec.dStep; input.value = d;
    lab.textContent = "Data-path delay"; lab.appendChild(val); wrapEl.appendChild(lab); wrapEl.appendChild(input); slc.appendChild(wrapEl); left.appendChild(slc);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function edge(t, color, label) {
      var X = tx(t);
      ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X, 26); ctx.lineTo(X, clkTopY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(X, clkTopY - 12); ctx.lineTo(X - 5, clkTopY - 3); ctx.lineTo(X + 5, clkTopY - 3); ctx.closePath(); ctx.fill();
      ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(label, X, 24);
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var T = spec.period, arrival = spec.tcq + d, hi = spec.thold, lo = T - spec.tsetup;
      /* data time axis */
      ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, axisY); ctx.lineTo(W - PAD, axisY); ctx.stroke();
      /* hold window (after launch edge) and setup window (before capture edge) */
      ctx.fillStyle = "rgba(220,38,38,0.16)"; ctx.fillRect(tx(0), axisY - 30, hi * sc, 40);
      ctx.fillStyle = "rgba(217,119,6,0.22)"; ctx.fillRect(tx(lo), axisY - 30, (T - lo) * sc, 40);
      ctx.fillStyle = "rgba(21,128,61,0.10)"; ctx.fillRect(tx(hi), axisY - 30, (lo - hi) * sc, 40);
      ctx.fillStyle = "#dc2626"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("hold window", tx(hi / 2), axisY - 32);
      ctx.fillStyle = "#7c3a06"; ctx.fillText("setup window", tx((lo + T) / 2), axisY - 32);
      ctx.fillStyle = "#15803d"; ctx.fillText("data may arrive here", tx((hi + lo) / 2), axisY - 32);
      /* data-path bars: clk->Q then the adjustable delay, ending at arrival */
      ctx.fillStyle = "#334155"; ctx.fillRect(tx(0), axisY - 14, spec.tcq * sc, 14); ctx.strokeStyle = "#fff"; ctx.strokeRect(tx(0), axisY - 14, spec.tcq * sc, 14);
      ctx.fillStyle = "rgba(37,99,237,0.5)"; ctx.fillRect(tx(spec.tcq), axisY - 14, d * sc, 14); ctx.strokeStyle = "#fff"; ctx.strokeRect(tx(spec.tcq), axisY - 14, d * sc, 14);
      ctx.fillStyle = "#334155"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; if (spec.tcq * sc > 14) ctx.fillText("cq", tx(spec.tcq / 2), axisY - 7);
      ctx.fillStyle = "#1d4ed8"; if (d * sc > 30) ctx.fillText("data path " + d.toFixed(2), tx(spec.tcq + d / 2), axisY - 7);
      /* arrival marker */
      var inHold = arrival < hi - 1e-9, inSetup = arrival > lo + 1e-9, ok = res.pass;
      var col = ok ? "#15803d" : "#dc2626";
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx(arrival), axisY - 34); ctx.lineTo(tx(arrival), axisY + 6); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tx(arrival), axisY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("data arrives " + arrival.toFixed(2), tx(arrival), axisY + 8);
      /* clock waveform with launch/capture edges */
      ctx.strokeStyle = "#2a5cc8"; ctx.lineWidth = 2; ctx.beginPath();
      var half = T / 2, pts = [[-0.3, clkBotY], [0, clkBotY], [0, clkTopY], [half, clkTopY], [half, clkBotY], [T, clkBotY], [T, clkTopY], [Math.min(span, T + half), clkTopY]];
      pts.forEach(function (p, i) { var px = tx(Math.max(-0.3, p[0])); if (i === 0) ctx.moveTo(px, p[1]); else ctx.lineTo(px, p[1]); }); ctx.stroke();
      ctx.fillStyle = "#2a5cc8"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("clk", x0 - 2, (clkTopY + clkBotY) / 2);
      edge(0, "#15803d", "LAUNCH ↑");
      edge(T, "#c23c32", "CAPTURE ↑");
    }
    function computeScore(res) {
      var margin = Math.min(res.setup, res.hold);
      var total = Math.round(Math.max(4000, Math.min(10000, 6000 + margin * 5000))), best = total;
      try { var key = "mp-best-" + (spec.id || "sta-setuphold"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(l, ok, v) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + (v >= 0 ? "+" : "") + v.toFixed(2) + ' ns</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Hold slack &ge; 0", res.holdOK, res.hold);
      html += row("Setup slack &ge; 0", res.setupOK, res.setup);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Both met. Centring the delay in the window gives the most margin against variation.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Both setup and hold met.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (res.holdOK ? "Too slow - setup is failing. Reduce the delay." : "Too fast - hold is failing. Increase the delay.") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { val.textContent = d.toFixed(2) + " ns"; last = evaluate(spec, d); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    input.addEventListener("input", function () { d = +input.value; scoreObj = null; refresh(); });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { d = spec.dStart; input.value = d; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaSetupHold = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
