/* STA: multi-corner sign-off. The same path is checked at every corner - SETUP
   against the slow corner, HOLD against the fast corner. Hold does not depend on
   the period, so a hold violation at the fast corner cannot be fixed by the
   clock; it needs added path delay, which in turn lengthens the slow-corner path
   and forces a bigger period. Balance both knobs so every corner meets setup and
   hold. window.StaCorners = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, T, a) {
    var setups = [], holds = [];
    spec.corners.forEach(function (c) { var dl = (spec.arrival + a) * c.mult; setups.push((T - spec.tsetup) - dl); holds.push(dl - spec.thold); });
    var minSetup = Math.min.apply(null, setups), minHold = Math.min.apply(null, holds);
    return { setups: setups, holds: holds, minSetup: minSetup, minHold: minHold, freq: 1000 / T,
      setupOK: minSetup >= -1e-9, holdOK: minHold >= -1e-9, pass: minSetup >= -1e-9 && minHold >= -1e-9 };
  }
  function mount(container, spec) {
    var PAD = 18, W = 560, rowH = 34, gap = 8, topH = 22;
    var Hpx = PAD * 2 + topH + spec.corners.length * (rowH + gap);
    var T = spec.periodStart, a = spec.aStart, scoreObj = null;
    var slowMult = Math.max.apply(null, spec.corners.map(function (c) { return c.mult; }));
    var fastMult = Math.min.apply(null, spec.corners.map(function (c) { return c.mult; }));

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "default"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var slc = document.createElement("div"); slc.className = "pdn-controls";
    function slider(label, min, max, step, valInit, unit) {
      var w = document.createElement("div"); w.className = "pdn-slider"; var l = document.createElement("label"); l.className = "pdn-slider-label"; var v = document.createElement("span"); v.className = "pdn-slider-val";
      var inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = valInit;
      l.textContent = label; l.appendChild(v); w.appendChild(l); w.appendChild(inp); slc.appendChild(w); return { inp: inp, v: v, unit: unit };
    }
    var sT = slider("Clock period", spec.periodMin, spec.periodMax, spec.periodStep, T, " ns");
    var sA = slider("Added min-delay (hold buffer)", spec.aMin, spec.aMax, spec.aStep, a, " ns");
    left.appendChild(slc);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var col0 = PAD + 110, colW = (W - col0 - PAD) / 2;
    function cell(cx, cy, w, v, governs) {
      var ok = v >= -1e-9;
      ctx.fillStyle = ok ? "rgba(21,128,61,0.16)" : "rgba(220,38,38,0.2)"; ctx.fillRect(cx, cy, w - 6, rowH - 8);
      ctx.strokeStyle = ok ? "#15803d" : "#dc2626"; ctx.lineWidth = governs ? 2.4 : 1; ctx.strokeRect(cx, cy, w - 6, rowH - 8);
      ctx.fillStyle = ok ? "#15803d" : "#dc2626"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((v >= 0 ? "+" : "") + v.toFixed(2), cx + (w - 6) / 2, cy + (rowH - 8) / 2);
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("setup slack", col0 + colW / 2, PAD); ctx.fillText("hold slack", col0 + colW + colW / 2, PAD);
      spec.corners.forEach(function (c, i) {
        var y = PAD + topH + i * (rowH + gap);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(c.n, PAD, y + (rowH - 8) / 2);
        cell(col0, y, colW, res.setups[i], c.mult === slowMult);
        cell(col0 + colW, y, colW, res.holds[i], c.mult === fastMult);
      });
    }
    function computeScore(res) { var total = Math.round(Math.max(4000, Math.min(10000, 10000 - res.minSetup * 4000 - a * 3000))), best = total; try { var key = "mp-best-" + (spec.id || "sta-corners"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.setupOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.setupOK ? "✔" : "✗") + '</span><span class="mp-label">Setup met (slow corner)</span><span class="mp-detail">worst ' + (res.minSetup >= 0 ? "+" : "") + res.minSetup.toFixed(2) + '</span></div>';
      html += '<div class="mp-row ' + (res.holdOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.holdOK ? "✔" : "✗") + '</span><span class="mp-label">Hold met (fast corner)</span><span class="mp-detail">worst ' + (res.minHold >= 0 ? "+" : "") + res.minHold.toFixed(2) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">clock ' + res.freq.toFixed(0) + ' MHz &middot; added delay ' + a.toFixed(2) + ' ns</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Hold closed at the fast corner with a buffer, setup at the slow corner with the period - the least delay and the fastest clock score highest.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every corner meets setup and hold.</b> Click <b>Submit design</b> to score it.</div>';
      else if (!res.holdOK) html += '<div class="mp-score"><span class="mp-score-note">Hold is failing at the fast corner. The clock period cannot fix hold - add min-delay (the hold buffer) until the fast-corner hold slack turns positive.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Hold is met but setup fails at the slow corner - your added delay lengthened the slow path. Raise the period (or trim the added delay if you over-did it).</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { sT.v.textContent = T.toFixed(2) + sT.unit; sA.v.textContent = a.toFixed(2) + sA.unit; last = evaluate(spec, T, a); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    sT.inp.addEventListener("input", function () { T = +sT.inp.value; scoreObj = null; refresh(); });
    sA.inp.addEventListener("input", function () { a = +sA.inp.value; scoreObj = null; refresh(); });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { T = spec.periodStart; a = spec.aStart; sT.inp.value = T; sA.inp.value = a; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaCorners = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
