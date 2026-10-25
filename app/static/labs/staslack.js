/* STA: slack and maximum frequency. A register-to-register path: launch
   clock-to-Q, combinational stages, capture setup. Drag the clock period down;
   setup slack = (period - setup) - arrival. Find the smallest period with
   slack >= 0 - the maximum frequency. window.StaSlack = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, T) {
    var unc = spec.uncertainty || 0;
    var arrival = spec.tcq + spec.stages.reduce(function (a, b) { return a + b.d; }, 0);
    var required = T - spec.tsetup - unc, slack = required - arrival;
    var fmax = 1000 / (arrival + spec.tsetup + unc);
    return { arrival: arrival, required: required, slack: slack, fmax: fmax, freq: 1000 / T,
      met: slack >= -1e-9, atLimit: slack >= -1e-9 && slack <= spec.marginBand,
      pass: slack >= -1e-9 && slack <= spec.marginBand };
  }
  function mount(container, spec) {
    var PAD = 24, W = 640, Hpx = 300, axisY = 120;
    var T = spec.periodStart, scoreObj = null;
    var arrival = spec.tcq + spec.stages.reduce(function (a, b) { return a + b.d; }, 0);
    var sc = (W - 2 * PAD - 60) / spec.periodMax;   // ns -> px

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var sl = document.createElement("div"); sl.className = "pdn-controls";
    var wrapEl = document.createElement("div"); wrapEl.className = "pdn-slider";
    var lab = document.createElement("label"); lab.className = "pdn-slider-label"; var val = document.createElement("span"); val.className = "pdn-slider-val";
    var input = document.createElement("input"); input.type = "range"; input.min = spec.periodMin; input.max = spec.periodMax; input.step = spec.periodStep; input.value = T;
    lab.textContent = "Clock period"; lab.appendChild(val); wrapEl.appendChild(lab); wrapEl.appendChild(input); sl.appendChild(wrapEl); left.appendChild(sl);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var x0 = PAD + 40;
    function tx(t) { return x0 + t * sc; }
    function edge(t, color, label) {
      var X = tx(t);
      ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X, 30); ctx.lineTo(X, clkTopY); ctx.stroke(); ctx.setLineDash([]);
      /* up-arrow at the clock rising edge */
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(X, clkTopY - 12); ctx.lineTo(X - 5, clkTopY - 3); ctx.lineTo(X + 5, clkTopY - 3); ctx.closePath(); ctx.fill();
      ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(label, X, 28);
    }
    var barY = axisY - 20, clkTopY = 210, clkBotY = 250;
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var unc = spec.uncertainty || 0, reqT = T - spec.tsetup - unc, negative = res.slack < 0;
      /* data time axis */
      ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, axisY); ctx.lineTo(W - PAD, axisY); ctx.stroke();
      ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("time (ns)", W - PAD, axisY - 3);
      /* clock-to-Q + combinational stage bars */
      var x = 0, cols = ["#0d9488", "#2563eb", "#7c3aed", "#0369a1", "#0d9488", "#2563eb"];
      function seg(w, color, label) { ctx.fillStyle = color; ctx.fillRect(tx(x), barY, w * sc, 20); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(tx(x), barY, w * sc, 20); if (w * sc > 20) { ctx.fillStyle = "#fff"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, tx(x) + w * sc / 2, barY + 10); } x += w; }
      seg(spec.tcq, "#334155", "cq");
      spec.stages.forEach(function (g, i) { seg(g.d, cols[i % cols.length], g.n); });
      /* labels under the two delay groups */
      ctx.fillStyle = "#334155"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("clk→Q " + spec.tcq.toFixed(2), tx(spec.tcq / 2), barY + 23);
      ctx.fillStyle = "#2563eb"; var logicSum = arrival - spec.tcq; ctx.fillText("combinational logic  " + logicSum.toFixed(2), tx(spec.tcq + logicSum / 2), barY + 23);
      /* arrival marker */
      ctx.strokeStyle = "#1a1d26"; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx(arrival), barY - 6); ctx.lineTo(tx(arrival), axisY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("data arrives " + arrival.toFixed(2), tx(arrival), barY - 7);
      /* reserved window at the capture edge (setup + uncertainty) */
      var reqX = tx(reqT);
      if (unc > 0) { ctx.fillStyle = "rgba(190,18,60,0.22)"; ctx.fillRect(reqX, barY - 4, unc * sc, 28); ctx.fillStyle = "#9f1239"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("uncert", reqX + unc * sc / 2, barY + 22); }
      ctx.fillStyle = "rgba(217,119,6,0.3)"; ctx.fillRect(tx(T - spec.tsetup), barY - 4, spec.tsetup * sc, 28);
      ctx.fillStyle = "#7c3a06"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("setup", tx(T - spec.tsetup) + spec.tsetup * sc / 2, barY + 22);
      /* slack arrow */
      ctx.strokeStyle = negative ? "#dc2626" : "#15803d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx(arrival), barY - 22); ctx.lineTo(tx(reqT), barY - 22); ctx.stroke();
      ctx.fillStyle = negative ? "#dc2626" : "#15803d"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("slack " + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(2), (tx(arrival) + tx(reqT)) / 2, barY - 24);
      /* clock waveform underneath, rising edges at 0 (launch) and T (capture) */
      ctx.strokeStyle = "#2a5cc8"; ctx.lineWidth = 2; ctx.beginPath();
      var half = T / 2, pts = [[-0.3, clkBotY], [0, clkBotY], [0, clkTopY], [half, clkTopY], [half, clkBotY], [T, clkBotY], [T, clkTopY]];
      var end = Math.min(spec.periodMax, T + half); pts.push([end, clkTopY]);
      pts.forEach(function (p, i) { var px2 = tx(Math.max(-0.3, p[0])); if (i === 0) ctx.moveTo(px2, p[1]); else ctx.lineTo(px2, p[1]); });
      ctx.stroke();
      ctx.fillStyle = "#2a5cc8"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("clk", x0 - 2, (clkTopY + clkBotY) / 2);
      /* bold launch / capture edges tying the waveform to the data timeline */
      edge(0, "#15803d", "LAUNCH ↑");
      edge(T, "#c23c32", "CAPTURE ↑  T=" + T.toFixed(2));
    }
    function computeScore(res) {
      var total = Math.round(Math.max(4000, Math.min(10000, 10000 - res.slack * 6000))), best = total;
      try { var key = "mp-best-" + (spec.id || "sta-slack"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : (res.met ? "mp-fail" : "mp-fail")) + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.met ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.met ? "✔" : "✗") + '</span><span class="mp-label">Setup slack &ge; 0</span><span class="mp-detail">' + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(2) + ' ns</span></div>';
      html += '<div class="mp-row ' + (res.atLimit ? "mp-ok" : "") + '"><span class="mp-mark">' + (res.atLimit ? "✔" : "○") + '</span><span class="mp-label">At the frequency limit</span><span class="mp-detail">' + res.freq.toFixed(0) + " MHz</span></div>";
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">theoretical Fmax = 1 / (arrival + setup) = <b>' + res.fmax.toFixed(0) + ' MHz</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">You found the max frequency: slack just reaches zero at the shortest period.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>At the limit - slack just barely positive.</b> Click <b>Submit design</b> to score it.</div>';
      else if (res.met) html += '<div class="mp-score"><span class="mp-score-note">Timing is met but you can run faster - drag the period down until slack is just above zero.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Slack is negative - the clock is too fast for this path. Ease the period back up.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { val.textContent = T.toFixed(2) + " ns"; last = evaluate(spec, T); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    input.addEventListener("input", function () { T = +input.value; scoreObj = null; refresh(); });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { T = spec.periodStart; input.value = T; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaSlack = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
