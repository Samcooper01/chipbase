/* Clock source balancing lab. A star clock: one root buffer drives every
   flip-flop clock pin directly. Each sink's arrival is its Manhattan distance
   from the root. Drag the root to equalize distances: minimize skew (latest
   minus earliest arrival) under target, keeping latency (the latest arrival)
   in budget. window.ClkBalance = { evaluate, mount }. */
(function () {
  "use strict";
  function heatColor(r) {
    var rr = Math.max(0, Math.min(1.3, r)), hue = 210 - 210 * Math.min(1, rr);
    return "hsl(" + hue.toFixed(0) + ",70%,52%)";
  }
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function evaluate(spec, root) {
    var d = spec.sinks.map(function (s) { return man(root, s); });
    var mx = Math.max.apply(null, d), mn = Math.min.apply(null, d);
    var skew = mx - mn, latency = mx;
    return { arrivals: d, skew: skew, latency: latency, minArr: mn, maxArr: mx,
      skewOK: skew <= spec.skewTarget + 1e-6, latOK: latency <= spec.latencyBudget + 1e-6,
      pass: skew <= spec.skewTarget + 1e-6 && latency <= spec.latencyBudget + 1e-6 };
  }
  function mount(container, spec) {
    var core = spec.core, PAD = 22, MAXPX = 470;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var root = { x: spec.root.x, y: spec.root.y }, scoreObj = null;

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
    hint.innerHTML = "Drag the clock root (diamond). Squares are flip-flop clock pins; the line to each is its clock path.";
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
      /* clock paths (L-shaped Manhattan) coloured by arrival */
      spec.sinks.forEach(function (s, i) {
        var ratio = res.maxArr > 0 ? res.arrivals[i] / res.maxArr : 0;
        ctx.strokeStyle = heatColor(ratio); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(mx(root.x), my(root.y)); ctx.lineTo(mx(s.x), my(root.y)); ctx.lineTo(mx(s.x), my(s.y)); ctx.stroke();
      });
      /* sinks */
      spec.sinks.forEach(function (s, i) {
        ctx.fillStyle = "rgba(13,148,136,0.2)"; ctx.fillRect(mx(s.x) - 5, my(s.y) - 4, 10, 8);
        ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 1.2; ctx.strokeRect(mx(s.x) - 5, my(s.y) - 4, 10, 8);
        ctx.fillStyle = "#134e4a"; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(res.arrivals[i].toFixed(0), mx(s.x), my(s.y));
      });
      /* root diamond */
      ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#7c3a06"; ctx.lineWidth = 1.5;
      ctx.beginPath(); var R = 8; ctx.moveTo(mx(root.x), my(root.y) - R); ctx.lineTo(mx(root.x) + R, my(root.y)); ctx.lineTo(mx(root.x), my(root.y) + R); ctx.lineTo(mx(root.x) - R, my(root.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("clk", mx(root.x), my(root.y));
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.skewTarget - res.skew) / Math.max(1, spec.skewTarget - spec.parSkew)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "cts-source"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(l, ok, d) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + l + '</span><span class="mp-detail">' + d + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Skew under target", res.skewOK, res.skew.toFixed(0) + " / " + spec.skewTarget);
      html += rowc("Latency in budget", res.latOK, res.latency.toFixed(0) + " / " + spec.latencyBudget);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Balanced. Less skew scores higher. Even the best star clock has irreducible skew - trees do better.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Skew and latency in budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, root); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = false;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, y: ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc }; }
    function down(e) { drag = true; move(e); e.preventDefault(); }
    function move(e) { if (!drag) return; var p = pt(e); root.x = Math.max(0, Math.min(core.w, p.x)); root.y = Math.max(0, Math.min(core.h, p.y)); scoreObj = null; refresh(); e.preventDefault(); }
    function up() { drag = false; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { root = { x: spec.root.x, y: spec.root.y }; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.ClkBalance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
