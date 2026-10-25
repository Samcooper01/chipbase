/* Buffer-level (stage-depth) balancing for on-chip variation. The heavy branches
   (bold) must carry a buffer for slew, giving their sinks a stage; the learner
   adds matching buffers on the shallow branches so EVERY sink passes through the
   same number of buffer stages. Equal depth makes process variation track across
   paths, so the on-chip-variation skew (jitter times the stage mismatch) goes to
   zero. Place each matching buffer where it lifts only the shallow sinks.
   depth(sink) = buffers on its path. window.ClkDepth = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) { var rr = Math.max(0, Math.min(1.3, r)), hue = 210 - 210 * Math.min(1, rr); return "hsl(" + hue.toFixed(0) + ",70%,52%)"; }
  function evaluate(spec, buf) {
    var nodes = spec.nodes;
    function pathEdges(i) { var e = [], n = i; while (n > 0) { e.push(n); n = nodes[n][0]; } return e; }
    var depth = {}; spec.leaves.forEach(function (l) { depth[l] = pathEdges(l).reduce(function (s, e) { return s + (buf[e] || 0); }, 0); });
    var ds = spec.leaves.map(function (l) { return depth[l]; });
    var maxD = Math.max.apply(null, ds), minD = Math.min.apply(null, ds), spread = maxD - minD;
    var slewViol = spec.heavy.filter(function (h) { return !(buf[h] > 0); });
    var total = spec.editable.reduce(function (s, e) { return s + (buf[e] || 0); }, 0);
    return { depth: depth, maxD: maxD, minD: minD, spread: spread, ocvSkew: spread * spec.jitterPerStage,
      slewViol: slewViol, total: total,
      depthOK: spread === 0, slewOK: slewViol.length === 0,
      pass: spread === 0 && slewViol.length === 0 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 24, MAXPX = 440;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var nodes = spec.nodes, children = spec.children;
    var buf = {}; spec.editable.forEach(function (e) { buf[e] = 0; }); var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">stages vs the deepest path</span><span class="mp-legend-bar" style="background:linear-gradient(90deg,hsl(0,70%,52%),hsl(210,70%,52%))"></span><span class="mp-legend-ends"><span>too few (add a stage)</span><span>matched</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Bold edges are heavy branches that need a buffer for slew. Click any edge to add a buffer (click past the max to clear). Each leaf shows its stage count.";
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
        if (n[0] < 0) return; var p = nodes[n[0]], hv = n[1], viol = hv && !(buf[i] > 0);
        ctx.strokeStyle = viol ? "#dc2626" : hv ? "#1a1d26" : "rgba(90,96,110,0.5)"; ctx.lineWidth = hv ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(mx(p[2]), my(p[3])); ctx.lineTo(mx(n[2]), my(p[3])); ctx.lineTo(mx(n[2]), my(n[3])); ctx.stroke();
        if (hv) { var em = edgeMid(i); ctx.fillStyle = viol ? "#dc2626" : "#1a1d26"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("heavy", mx(em.x) - 6, my(em.y)); }
        var d = buf[i] || 0; if (d > 0) {
          var m = edgeMid(i);
          for (var k = 0; k < d; k++) { ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1; var yy = my(m.y) - (d - 1) * 3.5 + k * 7; ctx.beginPath(); ctx.moveTo(mx(m.x) - 4, yy - 3); ctx.lineTo(mx(m.x) + 4, yy); ctx.lineTo(mx(m.x) - 4, yy + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        }
      });
      nodes.forEach(function (n, i) {
        var X = mx(n[2]), Y = my(n[3]);
        if (children[i].length === 0) {
          var dep = res.depth[i], ratio = res.spread > 0 ? (res.maxD - dep) / res.spread : 0;
          ctx.fillStyle = heatColor(ratio); ctx.fillRect(X - 9, Y - 6, 18, 12);
          ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.strokeRect(X - 9, Y - 6, 18, 12);
          ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(dep + " stg", X, Y);
        } else if (i === 0) { ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("root", X, Y - 8); }
        else { ctx.fillStyle = "#eef1f5"; ctx.strokeStyle = "#5a606e"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var par = spec.bufPar || 4, eff = Math.max(0, Math.min(1, (par * 2 - res.total) / par));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-depth"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Heavy branches buffered (slew)", res.slewOK, res.slewOK ? "all buffered" : res.slewViol.length + " unbuffered");
      html += rowc("Every path same depth (OCV)", res.depthOK, res.depthOK ? "all " + res.maxD + " stages" : "spread " + res.spread + " stages");
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">on-chip-variation skew from stage mismatch: <b>' + res.ocvSkew.toFixed(0) + '</b> ps &middot; buffers used: <b>' + res.total + '</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Equal depth everywhere - variation now tracks across paths. Fewer matching buffers scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Slew met and every path equal depth.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, buf); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      var bestE = -1, bestD = 26;
      spec.editable.forEach(function (i) {
        var m = edgeMid(i), n = nodes[i];
        /* register a click near the branch's midpoint OR near its node, so the
           whole branch is an easy target */
        var dd = Math.min(Math.hypot(px - mx(m.x), py - my(m.y)), Math.hypot(px - mx(n[2]), py - my(n[3])));
        if (dd < bestD) { bestD = dd; bestE = i; }
      });
      if (bestE >= 0) { buf[bestE] = (buf[bestE] + 1) % (spec.maxBuf + 1); scoreObj = null; refresh(); }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { spec.editable.forEach(function (e) { buf[e] = 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkDepth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
