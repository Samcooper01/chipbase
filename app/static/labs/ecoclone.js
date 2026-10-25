/* ECO lab: eco-clone (driver cloning and load split).
   A driver with high fanout is slow because its delay grows with the total load
   it drives. Cloning the driver into copies and splitting the sinks among them
   cuts each copy's load. The gain comes only from BALANCING the split: one copy
   left carrying most of the sinks still dominates. All sinks start on the
   original driver; the learner reassigns each sink to one of three driver copies
   so the worst copy's delay meets the limit. window.EcoClone = { evaluate, mount }. */
(function () {
  "use strict";
  var BASE = 1.0, F = 0.5, LIMIT = 2.6, NDRV = 3, NSINK = 9;
  var DCOL = ["#2563eb", "#0d9488", "#b45309"];
  function analyze(asg) {
    var counts = [0, 0, 0];
    for (var i = 0; i < NSINK; i++) counts[asg[i]]++;
    var delays = counts.map(function (c) { return c > 0 ? BASE + F * c : 0; });
    var worst = Math.max.apply(null, delays);
    return { counts: counts, delays: delays, worst: worst, pass: worst <= LIMIT + 1e-9 };
  }
  function evaluate(spec, asg) { return analyze(asg); }

  function mount(container, spec) {
    var W = 560, Hpx = 320, dpr = window.devicePixelRatio || 1;
    var asg = []; for (var i = 0; i < NSINK; i++) asg.push(0);
    var submitted = false, scoreObj = null;
    var drvX = 90, drvY = [70, 150, 230], sinkX = 380, sinkY0 = 40, sinkDy = 30;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The original driver <b>D0</b> drives all " + NSINK + " sinks, so its load, and its delay, are too high. Two clones (<b>D1</b>, <b>D2</b>) are available. <b>Click a sink</b> to move it to the next driver. Each driver's delay grows with the number of sinks it drives, so split the load and <b>balance</b> it: the worst driver sets the timing. Get every driver's delay at or under the limit (" + LIMIT.toFixed(1) + ").";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit split";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", DIM = "#334155";
    var hits = [];
    function sinkPos(i) { return [sinkX, sinkY0 + i * sinkDy]; }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* wires sink -> its driver */
      for (var i = 0; i < NSINK; i++) {
        var sp = sinkPos(i), d = asg[i];
        ctx.strokeStyle = DCOL[d]; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(drvX + 22, drvY[d]); ctx.lineTo(sp[0] - 10, sp[1]); ctx.stroke(); ctx.globalAlpha = 1;
      }
      /* drivers */
      for (var k = 0; k < NDRV; k++) {
        var over = res.delays[k] > LIMIT + 1e-9;
        var x = drvX, y = drvY[k];
        ctx.fillStyle = res.counts[k] === 0 ? "#f1f1ee" : (over ? "rgba(220,38,38,0.14)" : "rgba(21,128,61,0.12)");
        ctx.strokeStyle = res.counts[k] === 0 ? "#c9c6bd" : (over ? BAD : OK); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 22, y - 20); ctx.lineTo(x + 22, y); ctx.lineTo(x - 22, y + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = DCOL[k]; ctx.beginPath(); ctx.arc(x - 30, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("D" + k, x - 4, y);
        ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillStyle = over ? BAD : "#2d6a4f"; ctx.textBaseline = "top"; ctx.fillText(res.counts[k] + " sinks", x, y + 22);
        ctx.fillText(res.counts[k] ? "d=" + res.delays[k].toFixed(2) : "unused", x, y + 32);
      }
      /* upstream source feeding all drivers */
      ctx.fillStyle = "#6b7280"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("src", drvX - 52, drvY[1]);
      ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1; for (var k2 = 0; k2 < NDRV; k2++) { ctx.beginPath(); ctx.moveTo(drvX - 40, drvY[1]); ctx.lineTo(drvX - 22, drvY[k2]); ctx.stroke(); }
      /* sinks */
      for (var s = 0; s < NSINK; s++) {
        var sp2 = sinkPos(s), d2 = asg[s];
        ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = DCOL[d2]; ctx.lineWidth = 1.8; ctx.fillRect(sp2[0], sp2[1] - 9, 120, 18); ctx.strokeRect(sp2[0], sp2[1] - 9, 120, 18);
        ctx.fillStyle = "#1a1d26"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("sink " + (s + 1) + "  → D" + d2, sp2[0] + 6, sp2[1]);
        hits.push([sp2[0], sp2[1] - 9, sp2[0] + 120, sp2[1] + 9, s]);
      }
    }
    function computeScore(res) { var spread = Math.max.apply(null, res.counts) - Math.min.apply(null, res.counts.filter(function (c, i) { return true; })); var total = Math.round(Math.max(6000, 10000 - res.worst * 800)), best = total; try { var key = "mp-best-" + (spec.id || "eco-clone"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "balanced" : "overloaded") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Worst driver delay &le; limit</span><span class="mp-detail">' + res.worst.toFixed(2) + " / " + LIMIT.toFixed(1) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">loads: D0 ' + res.counts[0] + ' &middot; D1 ' + res.counts[1] + ' &middot; D2 ' + res.counts[2] + ' sinks</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">The fanout is split evenly across the three drivers, so no copy is overloaded and the worst-case delay is as low as it goes.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every driver is under the limit.</b> Click <b>Submit split</b>.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A driver is still carrying too much load (its delay sets the path). Move sinks off the heaviest driver onto a lighter one until the load is balanced across all three.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, asg); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { asg[h[4]] = (asg[h[4]] + 1) % NDRV; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { for (var i = 0; i < NSINK; i++) asg[i] = 0; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoClone = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
