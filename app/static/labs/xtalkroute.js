/* Crosstalk-aware routing lab, shown physically. Each victim net (coloured) runs
   between two aggressor wires (grey). Capacitive coupling to the aggressors -
   drawn as a red glow - injects crosstalk; the closer the aggressor, the worse.
   Click a net to cycle its routing: default (aggressors close), +spacing (push
   the aggressors out, halves coupling, +1 track), or shield (drop a grounded
   wire between victim and aggressor, cuts coupling to a fifth, +2 tracks). Bring
   every net under the crosstalk limit within the track budget.
   window.XtalkRoute = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, setg) {
    var over = [], tracks = 0, xs = [];
    spec.nets.forEach(function (n, i) {
      var c = n.coupling * spec.factors[setg[i]]; xs.push(c); tracks += spec.tracks[setg[i]];
      if (c > spec.limit + 1e-9) over.push(n.id);
    });
    return { xtalk: xs, over: over, tracks: tracks,
      xtOK: over.length === 0, trkOK: tracks <= spec.trackBudget,
      pass: over.length === 0 && tracks <= spec.trackBudget };
  }
  function mount(container, spec) {
    var PAD = 18, laneH = 74, gap = 8, W = 580;
    var Hpx = PAD * 2 + spec.nets.length * (laneH + gap);
    var wx0 = PAD + 40, wx1 = W - 150;
    var setg = spec.nets.map(function () { return 0; }), scoreObj = null;
    var maxC = Math.max.apply(null, spec.nets.map(function (n) { return n.coupling; }));
    var PAL = ["#2563eb", "#0d9488", "#7c3aed", "#be123c", "#d97706", "#0369a1"];

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.lineHeight = "1.5";
    hint.innerHTML = "Each coloured <b>victim</b> runs between two grey <b>aggressors</b>. The red glow is capacitive coupling: closer aggressor = more crosstalk. Click a net to cycle <b>default</b> &rarr; <b>+spacing</b> (push aggressors out, +1 track) &rarr; <b>shield</b> (grounded wire between them, +2 tracks).";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var lanes = [];
    function laneTop(i) { return PAD + i * (laneH + gap); }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); lanes = [];
      spec.nets.forEach(function (n, i) {
        var lt = laneTop(i), cy = lt + laneH / 2, s = setg[i], c = res.xtalk[i], over = c > spec.limit + 1e-9, col = PAL[i % PAL.length];
        var aggOff = s === 1 ? 28 : 16;   // +spacing pushes the aggressors out
        var yTopAgg = cy - aggOff, yBotAgg = cy + aggOff;
        /* coupling glow between victim and each aggressor (skip where a shield sits) */
        if (s !== 2) {
          var alpha = Math.min(0.55, (c / maxC) * 0.6);
          ctx.fillStyle = "rgba(220,38,38," + alpha.toFixed(2) + ")";
          ctx.fillRect(wx0, yTopAgg, wx1 - wx0, cy - yTopAgg);
          ctx.fillRect(wx0, cy, wx1 - wx0, yBotAgg - cy);
        }
        /* aggressor wires */
        ctx.strokeStyle = "#8a90a0"; ctx.lineWidth = 3;
        [yTopAgg, yBotAgg].forEach(function (yy) { ctx.beginPath(); ctx.moveTo(wx0, yy); ctx.lineTo(wx1, yy); ctx.stroke(); });
        ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("aggressor", wx0, yTopAgg - 3);
        /* grounded shields when shielding */
        if (s === 2) {
          ctx.strokeStyle = "#15803d"; ctx.lineWidth = 2.4; ctx.setLineDash([4, 3]);
          [cy - 8, cy + 8].forEach(function (yy) { ctx.beginPath(); ctx.moveTo(wx0, yy); ctx.lineTo(wx1, yy); ctx.stroke(); });
          ctx.setLineDash([]);
        }
        /* victim wire */
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx0, cy); ctx.lineTo(wx1, cy); ctx.stroke();
        ctx.fillStyle = col; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(n.id, PAD, cy);
        /* crosstalk readout + routing label on the right */
        ctx.fillStyle = over ? "#dc2626" : "#2d6a4f"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText("xt " + c.toFixed(2) + " / " + spec.limit, wx1 + 8, cy - 4);
        ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillText(spec.labels[s] + (spec.tracks[s] ? " (+" + spec.tracks[s] + " trk)" : ""), wx1 + 8, cy + 12);
        lanes.push([PAD, lt, W - PAD, lt + laneH, i]);
      });
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.trackBudget - res.tracks + 1) / spec.trackBudget));
      var total = res.pass ? Math.round(6000 + 4000 * eff) : 4000, best = total;
      try { var key = "mp-best-" + (spec.id || "route-xtalk"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Every net under crosstalk limit", res.xtOK, res.xtOK ? "all clear" : res.over.length + " over");
      html += rowc("Extra tracks within budget", res.trkOK, res.tracks + " / " + spec.trackBudget);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Clean and in budget. Shield only where spacing is not enough.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All nets clear within budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, setg); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < lanes.length; i++) { var L = lanes[i]; if (px >= L[0] && px <= L[2] && py >= L[1] && py <= L[3]) { setg[L[4]] = (setg[L[4]] + 1) % 3; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { setg = spec.nets.map(function () { return 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.XtalkRoute = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
