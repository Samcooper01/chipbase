/* H-tree construction lab. A root at die centre drives four tap points, one per
   quadrant of a 4x4 sink grid; each tap drives its four sinks. Arrival =
   |root->tap| + |tap->sink|. Drag the taps to the symmetric, centred positions
   that equalize every path (the H-tree), bringing skew under target with
   latency in budget. window.HTree = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) { var rr = Math.max(0, Math.min(1.3, r)), hue = 210 - 210 * Math.min(1, rr); return "hsl(" + hue.toFixed(0) + ",70%,52%)"; }
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function euc(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
  function evaluate(spec, taps) {
    var d = spec.diag ? euc : man;   // X-tree uses straight (Euclidean) diagonal wires; H-tree uses Manhattan
    var arr = spec.sinks.map(function (s, i) { var t = taps[spec.quadOf[i]]; return d(spec.root, t) + d(t, s); });
    var mx = Math.max.apply(null, arr), mn = Math.min.apply(null, arr);
    var armLens = taps.map(function (t) { return d(spec.root, t); });
    return { arrivals: arr, armLens: armLens, skew: mx - mn, latency: mx, maxArr: mx,
      skewOK: (mx - mn) <= spec.skewTarget + 1e-6, latOK: mx <= spec.latencyBudget + 1e-6,
      pass: (mx - mn) <= spec.skewTarget + 1e-6 && mx <= spec.latencyBudget + 1e-6 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 22, MAXPX = 470;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var taps = spec.taps.map(function (t) { return { x: t.x, y: t.y }; }), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "grab"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend";
    legend.innerHTML = '<span class="mp-legend-title">clock arrival</span><span class="mp-legend-bar" style="background:linear-gradient(90deg,hsl(210,70%,52%),hsl(0,70%,52%))"></span><span class="mp-legend-ends"><span>early</span><span>late</span></span>';
    left.appendChild(legend);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Drag the four tap nodes (orange). Each feeds one quadrant of sinks. Equalize the four arms and centre each tap.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* quadrant dividers */
      ctx.strokeStyle = "rgba(90,96,110,0.18)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx(core.w / 2), my(0)); ctx.lineTo(mx(core.w / 2), my(core.h)); ctx.moveTo(mx(0), my(core.h / 2)); ctx.lineTo(mx(core.w), my(core.h / 2)); ctx.stroke();
      var diag = !!spec.diag;
      /* root->tap arms (straight for X-tree, L-shaped for H-tree) */
      taps.forEach(function (t) { ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(mx(spec.root.x), my(spec.root.y)); if (!diag) ctx.lineTo(mx(t.x), my(spec.root.y)); ctx.lineTo(mx(t.x), my(t.y)); ctx.stroke(); });
      /* tap->sink */
      spec.sinks.forEach(function (s, i) {
        var t = taps[spec.quadOf[i]], ratio = res.maxArr > 0 ? res.arrivals[i] / res.maxArr : 0;
        ctx.strokeStyle = heatColor(ratio); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(mx(t.x), my(t.y)); if (!diag) ctx.lineTo(mx(s.x), my(t.y)); ctx.lineTo(mx(s.x), my(s.y)); ctx.stroke();
      });
      spec.sinks.forEach(function (s, i) {
        ctx.fillStyle = "rgba(13,148,136,0.2)"; ctx.fillRect(mx(s.x) - 4, my(s.y) - 4, 8, 8);
        ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 1; ctx.strokeRect(mx(s.x) - 4, my(s.y) - 4, 8, 8);
      });
      taps.forEach(function (t, i) {
        ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1.4;
        ctx.beginPath(); var R = 7; ctx.moveTo(mx(t.x), my(t.y) - R); ctx.lineTo(mx(t.x) + R, my(t.y)); ctx.lineTo(mx(t.x), my(t.y) + R); ctx.lineTo(mx(t.x) - R, my(t.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#7c3a06"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("arm " + res.armLens[i].toFixed(0), mx(t.x), my(t.y) - 9);
      });
      /* root */
      ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(mx(spec.root.x), my(spec.root.y), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("clk root", mx(spec.root.x), my(spec.root.y) - 8);
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.skewTarget - res.skew) / Math.max(1, spec.skewTarget - spec.parSkew)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-htree"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Skew under target", res.skewOK, res.skew.toFixed(0) + " / " + spec.skewTarget);
      html += rowc("Latency in budget", res.latOK, res.latency.toFixed(0) + " / " + spec.latencyBudget);
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">arms: ' + res.armLens.map(function (a) { return a.toFixed(0); }).join(", ") + ' (equal arms = balanced)</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Symmetric and balanced. This is why the H-tree is the classic zero-skew structure.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Balanced.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, taps); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = -1;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, y: ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc }; }
    function down(e) { var p = pt(e); for (var i = 0; i < taps.length; i++) { if (Math.abs(p.x - taps[i].x) < 12 && Math.abs(p.y - taps[i].y) < 12) { drag = i; break; } } if (drag >= 0) { move(e); e.preventDefault(); } }
    function move(e) {
      if (drag < 0) return; var p = pt(e), q = spec.qbox[drag];
      taps[drag].x = Math.max(q.x0 - 6, Math.min(q.x1 + 6, p.x));
      taps[drag].y = Math.max(q.y0 - 6, Math.min(q.y1 + 6, p.y));
      scoreObj = null; refresh(); e.preventDefault();
    }
    function up() { drag = -1; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { taps = spec.taps.map(function (t) { return { x: t.x, y: t.y }; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.HTree = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
