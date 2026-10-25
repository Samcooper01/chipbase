/* Track assignment lab. Each wire is a fixed horizontal span; two wires on the
   same track collide if their spans overlap. Click a wire to move it to another
   track. Pack every wire onto the available tracks with no overlaps.
   window.TrackAssign = { evaluate, mount }. */
(function () {
  "use strict";
  function ov(a, b) { return a.x0 < b.x1 && b.x0 < a.x1; }
  function evaluate(spec, assign) {
    var conflicts = [];
    for (var i = 0; i < spec.wires.length; i++) for (var j = i + 1; j < spec.wires.length; j++) {
      if (assign[i] === assign[j] && ov(spec.wires[i], spec.wires[j])) { conflicts.push([i, j]); }
    }
    var used = {}; assign.forEach(function (t) { used[t] = true; });
    return { conflicts: conflicts, tracksUsed: Object.keys(used).length, pass: conflicts.length === 0 };
  }
  function mount(container, spec) {
    var PAD = 24, W = 500, laneH = 40, gap = 10;
    var Hpx = PAD * 2 + spec.tracks * laneH + (spec.tracks - 1) * gap + 10;
    var innerW = W - 2 * PAD, sc = innerW / spec.axis;
    var assign = spec.wires.map(function () { return 0; }), scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.innerHTML = "Click a wire to move it down a track (wraps to the top). Wires that overlap on the same track glow red.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function laneY(t) { return PAD + 6 + t * (laneH + gap); }
    var bars = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var conf = {}; res.conflicts.forEach(function (c) { conf[c[0]] = true; conf[c[1]] = true; });
      for (var t = 0; t < spec.tracks; t++) {
        var y = laneY(t);
        ctx.fillStyle = "#f6f5f0"; ctx.fillRect(PAD, y, innerW, laneH); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(PAD, y, innerW, laneH);
        ctx.fillStyle = "#9aa0aa"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("track " + t, PAD + 3, y + 2);
      }
      bars = [];
      spec.wires.forEach(function (w, i) {
        var y = laneY(assign[i]) + 12, x = PAD + w.x0 * sc, ww = (w.x1 - w.x0) * sc, bad = conf[i];
        ctx.fillStyle = bad ? "rgba(220,38,38,0.35)" : "rgba(37,99,237,0.28)"; ctx.fillRect(x, y, ww, 18);
        ctx.strokeStyle = bad ? "#dc2626" : "#2f6fed"; ctx.lineWidth = bad ? 2 : 1.3; ctx.strokeRect(x, y, ww, 18);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(w.id, x + ww / 2, y + 9);
        bars.push([x, y, x + ww, y + 18, i]);
      });
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.tracks - res.tracksUsed + 1) / spec.tracks));
      var total = res.pass ? Math.round(6000 + 4000 * eff) : 4000, best = total;
      try { var key = "mp-best-" + (spec.id || "route-track"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">No overlaps on a track</span><span class="mp-detail">' + (res.conflicts.length ? res.conflicts.length + " colliding pairs" : "clean, " + res.tracksUsed + " tracks") + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Packed with no overlaps. Fewer tracks scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every wire on a clear track.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, assign); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var i = 0; i < bars.length; i++) { var b = bars[i]; if (px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3]) { assign[b[4]] = (assign[b[4]] + 1) % spec.tracks; scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { assign = spec.wires.map(function () { return 0; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.TrackAssign = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
