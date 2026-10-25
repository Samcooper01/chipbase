/* Skew balancing / delay matching lab. A fixed clock tree delivers the clock at
   different times. Click an edge to add delay (buffers) on it, lifting every
   sink below it, until all sinks arrive together (skew under target). Delay on a
   shared edge lifts many sinks at once, so balancing high in the tree spends
   fewer buffers. Keep latency in budget, with the least total delay.
   window.ClkSkew = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) { var rr = Math.max(0, Math.min(1.3, r)), hue = 210 - 210 * Math.min(1, rr); return "hsl(" + hue.toFixed(0) + ",70%,52%)"; }
  function evaluate(spec, delaySteps) {
    var nodes = spec.nodes, children = spec.children, N = nodes.length;
    var isLeaf = nodes.map(function (n, i) { return children[i].length === 0; });
    function pathEdges(i) { var e = [], n = i; while (n > 0) { e.push(n); n = nodes[n][0]; } return e; }
    var arr = {};
    for (var i = 0; i < N; i++) if (isLeaf[i]) { var a = 0; pathEdges(i).forEach(function (e) { a += nodes[e][1] + spec.step * (delaySteps[e] || 0); }); arr[i] = a; }
    var vals = Object.keys(arr).map(function (k) { return arr[k]; });
    var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var total = spec.editable.reduce(function (s, e) { return s + (delaySteps[e] || 0); }, 0);
    return { arr: arr, isLeaf: isLeaf, skew: mx - mn, latency: mx, maxArr: mx, minArr: mn, totalSteps: total,
      skewOK: (mx - mn) <= spec.skewTarget + 1e-6, latOK: mx <= spec.latencyBudget + 1e-6,
      pass: (mx - mn) <= spec.skewTarget + 1e-6 && mx <= spec.latencyBudget + 1e-6 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 24, MAXPX = 440;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var nodes = spec.nodes, children = spec.children;
    var delay = {}; spec.editable.forEach(function (e) { delay[e] = 0; }); var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">how far behind the latest sink</span><span class="mp-legend-bar" style="background:linear-gradient(90deg,hsl(0,70%,52%),hsl(210,70%,52%))"></span><span class="mp-legend-ends"><span>early (raise it)</span><span>at the target</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Click an edge to add a delay buffer (click past the max to clear it). Delay on a higher, shared edge lifts several sinks at once.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function edgeMid(i) { var n = nodes[i], p = nodes[n[0]]; return { x: n[2], y: (p[3] + n[3]) / 2 }; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      nodes.forEach(function (n, i) {
        if (n[0] < 0) return; var p = nodes[n[0]];
        ctx.strokeStyle = "rgba(90,96,110,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx(p[2]), my(p[3])); ctx.lineTo(mx(n[2]), my(p[3])); ctx.lineTo(mx(n[2]), my(n[3])); ctx.stroke();
        /* delay buffers on the edge */
        var d = delay[i] || 0; if (d > 0) {
          var m = edgeMid(i);
          for (var k = 0; k < d; k++) { ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1; var yy = my(m.y) - (d - 1) * 3.5 + k * 7; ctx.beginPath(); ctx.moveTo(mx(m.x) - 4, yy - 3); ctx.lineTo(mx(m.x) + 4, yy); ctx.lineTo(mx(m.x) - 4, yy + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          ctx.fillStyle = "#7c3a06"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("+" + (d * spec.step), mx(m.x) + 8, my(m.y));
        }
      });
      nodes.forEach(function (n, i) {
        var X = mx(n[2]), Y = my(n[3]);
        if (res.isLeaf[i]) {
          /* colour by how far BEHIND the latest sink this one is: the early
             sinks (the ones we must raise) read hot, the latest reads cool */
          var span = res.maxArr - res.minArr, ratio = span > 0 ? (res.maxArr - res.arr[i]) / span : 0;
          ctx.fillStyle = heatColor(ratio); ctx.fillRect(X - 8, Y - 6, 16, 12);
          ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.strokeRect(X - 8, Y - 6, 16, 12);
          ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(res.arr[i].toFixed(0), X, Y);
        } else if (i === 0) { ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("root", X, Y - 8); }
        else { ctx.fillStyle = "#eef1f5"; ctx.strokeStyle = "#5a606e"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var par = spec.stepPar || 8, eff = Math.max(0, Math.min(1, (par * 2 - res.totalSteps) / par));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-skewbal"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Skew under target", res.skewOK, res.skew.toFixed(0) + " / " + spec.skewTarget);
      html += rowc("Latency in budget", res.latOK, res.latency.toFixed(0) + " / " + spec.latencyBudget);
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">delay buffers used: <b>' + res.totalSteps + '</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Balanced. Fewer delay buffers (balance high on shared edges) scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Balanced and in budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, delay); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      var bestE = -1, bestD = 16;
      spec.editable.forEach(function (i) { var m = edgeMid(i), dd = Math.hypot(px - mx(m.x), py - my(m.y)); if (dd < bestD) { bestD = dd; bestE = i; } });
      if (bestE >= 0) { delay[bestE] = (delay[bestE] + 1) % (spec.maxSteps + 1); scoreObj = null; refresh(); }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { spec.editable.forEach(function (e) { delay[e] = 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkSkew = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
