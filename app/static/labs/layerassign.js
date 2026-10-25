/* Layer assignment lab. Each net sits on a metal layer. Upper layers are faster
   (lower delay per unit length) but have fewer tracks. A critical net must meet
   delay = length x the layer's delay factor, under the budget. Click a net to
   move it up a layer. Put long critical nets on the fast upper layers, fill the
   lower layers with the rest, and keep every layer within its track count.
   window.LayerAssign = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, assign) {
    var nL = spec.layers.length, cnt = new Array(nL).fill(0), critViol = [], details = [];
    spec.nets.forEach(function (n, i) {
      var L = spec.layers[assign[i]], delay = n.len * L.delay; cnt[assign[i]]++;
      var bad = n.critical && delay > spec.critBudget + 1e-9;
      if (bad) critViol.push(n.id);
      details.push({ delay: delay, bad: bad });
    });
    var capViol = []; cnt.forEach(function (c, l) { if (c > spec.layers[l].cap) capViol.push(l); });
    return { cnt: cnt, details: details, critViol: critViol, capViol: capViol,
      critOK: critViol.length === 0, capOK: capViol.length === 0,
      pass: critViol.length === 0 && capViol.length === 0 };
  }
  function mount(container, spec) {
    var PAD = 20, W = 500, bandH = 86, gap = 12, nL = spec.layers.length;
    var Hpx = PAD * 2 + nL * bandH + (nL - 1) * gap;
    var assign = spec.start.slice(), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click a net to move it up a layer (wraps to the bottom). Bold = critical (must meet its delay budget). A layer bar turns red when it is over its track count.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    /* layer 0 (M3) at the bottom, highest layer at the top */
    function bandY(layer) { return PAD + (nL - 1 - layer) * (bandH + gap); }
    var chips = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      chips = [];
      for (var l = 0; l < nL; l++) {
        var y = bandY(l), L = spec.layers[l], over = res.cnt[l] > L.cap;
        ctx.fillStyle = "#f6f5f0"; ctx.fillRect(PAD, y, W - 2 * PAD, bandH);
        ctx.strokeStyle = over ? "#dc2626" : "#8a90a0"; ctx.lineWidth = over ? 2.2 : 1.2; ctx.strokeRect(PAD, y, W - 2 * PAD, bandH);
        ctx.fillStyle = over ? "#dc2626" : "#5a606e"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(L.id + "  x" + L.delay + " delay   " + res.cnt[l] + "/" + L.cap + " tracks", PAD + 6, y + 5);
        /* chips for nets on this layer */
        var idxs = []; spec.nets.forEach(function (n, i) { if (assign[i] === l) idxs.push(i); });
        var cw = 58, ch = 34, x0 = PAD + 8, yy = y + 26;
        idxs.forEach(function (i, k) {
          var n = spec.nets[i], det = res.details[i], x = x0 + k * (cw + 6);
          ctx.fillStyle = n.critical ? (det.bad ? "rgba(220,38,38,0.2)" : "rgba(217,119,6,0.18)") : "rgba(37,99,237,0.12)";
          ctx.fillRect(x, yy, cw, ch);
          ctx.strokeStyle = n.critical ? (det.bad ? "#dc2626" : "#d97706") : "#5a7"; ctx.lineWidth = n.critical ? 1.8 : 1.1; ctx.strokeRect(x, yy, cw, ch);
          ctx.fillStyle = "#1a1d26"; ctx.font = (n.critical ? "bold " : "") + "9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.id + " L" + n.len, x + cw / 2, yy + 11);
          if (n.critical) { ctx.fillStyle = det.bad ? "#dc2626" : "#2d6a4f"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("d=" + det.delay.toFixed(1) + "/" + spec.critBudget, x + cw / 2, yy + 25); }
          chips.push([x, yy, x + cw, yy + ch, i]);
        });
      }
    }
    function computeScore(res) {
      var slackSum = 0, nc = 0; spec.nets.forEach(function (n, i) { if (n.critical) { slackSum += Math.max(0, (spec.critBudget - res.details[i].delay) / spec.critBudget); nc++; } });
      var eff = nc ? slackSum / nc : 1;
      var total = Math.round(4000 + 6000 * Math.min(1, eff / 0.5)), best = total;
      try { var key = "mp-best-" + (spec.id || "route-layer"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Critical nets meet delay", res.critOK, res.critOK ? "all met" : res.critViol.join(", ") + " slow");
      html += rowc("Layers within track count", res.capOK, res.capOK ? "all fit" : res.capViol.map(function (l) { return spec.layers[l].id; }).join(", ") + " over");
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Critical nets fast, layers within budget. More timing margin scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All nets legal and timed.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, assign); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < chips.length; i++) { var c = chips[i]; if (px >= c[0] && px <= c[2] && py >= c[1] && py <= c[3]) { assign[c[4]] = (assign[c[4]] + 1) % nL; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { assign = spec.start.slice(); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.LayerAssign = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
