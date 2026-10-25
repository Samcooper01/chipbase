/* Clustered buffer tree lab. The learner DRAGS K cluster taps (buffer merge
   points). Each sink is driven by its nearest tap, so moving a tap reshapes its
   cluster; the root drives the taps. Arrival = |root->tap| + |tap->sink|. Spread
   the taps so each owns a compact group of sinks and the root-to-tap arms are
   balanced, minimizing skew. window.ClkTree = { evaluate, mount }. */
(function () {
  "use strict";
  var PAL = ["#2563eb", "#d97706", "#0d9488", "#7c3aed", "#be123c"];
  function heatColor(r) { var rr = Math.max(0, Math.min(1.3, r)), hue = 210 - 210 * Math.min(1, rr); return "hsl(" + hue.toFixed(0) + ",70%,52%)"; }
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function evaluate(spec, taps) {
    var assign = [], cn = new Array(taps.length).fill(0);
    var arr = spec.sinks.map(function (s) {
      var best = 1e9, bi = 0;
      taps.forEach(function (t, k) { var d = man(t, s); if (d < best) { best = d; bi = k; } });
      assign.push(bi); cn[bi]++;
      return man(spec.root, taps[bi]) + best;
    });
    var mx = Math.max.apply(null, arr), mn = Math.min.apply(null, arr);
    return { assign: assign, cn: cn, arrivals: arr, skew: mx - mn, latency: mx, maxArr: mx,
      armLens: taps.map(function (t) { return man(spec.root, t); }),
      skewOK: (mx - mn) <= spec.skewTarget + 1e-6, latOK: mx <= spec.latencyBudget + 1e-6,
      pass: (mx - mn) <= spec.skewTarget + 1e-6 && mx <= spec.latencyBudget + 1e-6 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 22, MAXPX = 460;
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
    hint.innerHTML = "Drag the tap buffers (diamonds). Each sink is captured by its nearest tap, so moving a tap reshapes its cluster.";
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
      /* root->tap arms */
      taps.forEach(function (t, k) { ctx.strokeStyle = PAL[k]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(mx(spec.root.x), my(spec.root.y)); ctx.lineTo(mx(t.x), my(spec.root.y)); ctx.lineTo(mx(t.x), my(t.y)); ctx.stroke(); });
      /* tap->sink */
      spec.sinks.forEach(function (s, i) { var k = res.assign[i], t = taps[k]; var ratio = res.maxArr > 0 ? res.arrivals[i] / res.maxArr : 0; ctx.strokeStyle = heatColor(ratio); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(mx(t.x), my(t.y)); ctx.lineTo(mx(s.x), my(t.y)); ctx.lineTo(mx(s.x), my(s.y)); ctx.stroke(); });
      /* sinks coloured by owning cluster */
      spec.sinks.forEach(function (s, i) { ctx.fillStyle = PAL[res.assign[i]]; ctx.fillRect(mx(s.x) - 5, my(s.y) - 4, 10, 8); ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 0.8; ctx.strokeRect(mx(s.x) - 5, my(s.y) - 4, 10, 8); });
      /* root */
      ctx.fillStyle = "#1a1d26"; ctx.beginPath(); ctx.arc(mx(spec.root.x), my(spec.root.y), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("clk root", mx(spec.root.x), my(spec.root.y) - 8);
      /* taps (draggable) */
      taps.forEach(function (t, k) { ctx.fillStyle = PAL[k]; ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.4; ctx.beginPath(); var R = 8; ctx.moveTo(mx(t.x), my(t.y) - R); ctx.lineTo(mx(t.x) + R, my(t.y)); ctx.lineTo(mx(t.x), my(t.y) + R); ctx.lineTo(mx(t.x) - R, my(t.y)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("T" + (k + 1), mx(t.x), my(t.y)); });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.skewTarget - res.skew) / Math.max(1, spec.skewTarget - spec.parSkew)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-cluster"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Skew under target", res.skewOK, res.skew.toFixed(0) + " / " + spec.skewTarget);
      html += rowc("Latency in budget", res.latOK, res.latency.toFixed(0) + " / " + spec.latencyBudget);
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">cluster sizes: ' + res.cn.join(", ") + ' &middot; arms: ' + res.armLens.map(function (a) { return a.toFixed(0); }).join(", ") + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Compact clusters plus balanced arms drive skew lower.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Skew and latency in budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, taps); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = -1;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, y: ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc }; }
    function down(e) { var p = pt(e); for (var i = 0; i < taps.length; i++) { if (Math.abs(p.x - taps[i].x) < 12 && Math.abs(p.y - taps[i].y) < 12) { drag = i; break; } } if (drag >= 0) { move(e); e.preventDefault(); } }
    function move(e) { if (drag < 0) return; var p = pt(e); taps[drag].x = Math.max(0, Math.min(core.w, p.x)); taps[drag].y = Math.max(0, Math.min(core.h, p.y)); scoreObj = null; refresh(); e.preventDefault(); }
    function up() { drag = -1; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { taps = spec.taps.map(function (t) { return { x: t.x, y: t.y }; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkTree = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
