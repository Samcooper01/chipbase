/* Multi-pin (Steiner) routing lab - teaches wire sharing. One net: a root pin
   and several pins, each reaching the root by an L that bends horizontal-first
   or vertical-first. Where two pins' wires run along the same track the metal is
   SHARED and counted once, so the tree length is the union of all segments.
   Flip bends to funnel the routes onto common trunks and shrink the tree.
   window.Steiner = { evaluate, mount }. */
(function () {
  "use strict";
  function edgesOf(root, pin, opt) {
    var e = [];
    function hseg(x0, x1, yy) { var lo = Math.min(x0, x1), hi = Math.max(x0, x1); for (var i = lo; i < hi; i++) e.push("h," + i + "," + yy); }
    function vseg(y0, y1, xx) { var lo = Math.min(y0, y1), hi = Math.max(y0, y1); for (var i = lo; i < hi; i++) e.push("v," + xx + "," + i); }
    if (opt === 0) { hseg(pin.x, root.x, pin.y); vseg(pin.y, root.y, root.x); }
    else { vseg(pin.y, root.y, pin.x); hseg(pin.x, root.x, root.y); }
    return e;
  }
  function evaluate(spec, choice) {
    var usage = {};
    spec.pins.forEach(function (p, i) { edgesOf(spec.root, p, choice[i]).forEach(function (k) { usage[k] = (usage[k] || 0) + 1; }); });
    var unionLen = Object.keys(usage).length;
    return { usage: usage, unionLen: unionLen, wlOK: unionLen <= spec.wlTarget, pass: unionLen <= spec.wlTarget };
  }
  function mount(container, spec) {
    var g = spec.grid, PAD = 22, sc = Math.floor(540 / Math.max(g.w, g.h));
    var W = g.w * sc + PAD * 2, Hpx = g.h * sc + PAD * 2;
    function px(x) { return PAD + x * sc; } function py(y) { return PAD + y * sc; }
    var choice = spec.start.slice(), scoreObj = null;
    var starLen = spec.pins.reduce(function (s, p) { return s + Math.abs(p.x - spec.root.x) + Math.abs(p.y - spec.root.y); }, 0);

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend-title"; legend.style.display = "block"; legend.style.margin = "8px 0"; legend.style.lineHeight = "1.5";
    legend.innerHTML = '<span style="color:#2563eb;font-weight:700">&#9644; one wire</span> &nbsp; <span style="color:#ea580c;font-weight:700">&#9644; shared trunk (counted once)</span><br>Click a pin to flip its L. Funnel the routes onto shared trunks to shrink the tree.';
    left.appendChild(legend);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(px(0), py(0), g.w * sc, g.h * sc);
      /* faint grid */
      ctx.strokeStyle = "rgba(120,125,135,0.12)"; ctx.lineWidth = 0.5;
      for (var x = 0; x <= g.w; x++) { ctx.beginPath(); ctx.moveTo(px(x), py(0)); ctx.lineTo(px(x), py(g.h)); ctx.stroke(); }
      for (var y = 0; y <= g.h; y++) { ctx.beginPath(); ctx.moveTo(px(0), py(y)); ctx.lineTo(px(g.w), py(y)); ctx.stroke(); }
      /* edges: shared (usage>1) drawn thick orange, single blue */
      Object.keys(res.usage).forEach(function (k) {
        var p = k.split(","), shared = res.usage[k] > 1, a = +p[1], b = +p[2];
        ctx.strokeStyle = shared ? "#ea580c" : "#2563eb"; ctx.lineWidth = shared ? 5 : 2.6; ctx.lineCap = "round";
        ctx.beginPath();
        if (p[0] === "h") { ctx.moveTo(px(a), py(b)); ctx.lineTo(px(a + 1), py(b)); }
        else { ctx.moveTo(px(a), py(b)); ctx.lineTo(px(a), py(b + 1)); }
        ctx.stroke();
      });
      /* pins + root */
      spec.pins.forEach(function (p, i) {
        ctx.fillStyle = "rgba(13,148,136,0.3)"; ctx.fillRect(px(p.x) - 5, py(p.y) - 5, 10, 10);
        ctx.strokeStyle = "#0d9488"; ctx.lineWidth = 1.4; ctx.strokeRect(px(p.x) - 5, py(p.y) - 5, 10, 10);
      });
      ctx.fillStyle = "#1a1d26"; ctx.beginPath(); var R = 7; ctx.moveTo(px(spec.root.x), py(spec.root.y) - R); ctx.lineTo(px(spec.root.x) + R, py(spec.root.y)); ctx.lineTo(px(spec.root.x), py(spec.root.y) + R); ctx.lineTo(px(spec.root.x) - R, py(spec.root.y)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("root", px(spec.root.x), py(spec.root.y) - 9);
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(px(0), py(0), g.w * sc, g.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.wlTarget - res.unionLen) / Math.max(1, spec.wlTarget - spec.par + 2)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "route-steiner"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.wlOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.wlOK ? "✔" : "✗") + '</span><span class="mp-label">Tree wire under target</span><span class="mp-detail">' + res.unionLen + " / " + spec.wlTarget + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">no sharing at all (a star) would be <b>' + starLen + '</b> - the shared trunks are what save it</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">The routes share common trunks (orange). That sharing is what a Steiner tree buys.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under target.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choice); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0 = canvas.getBoundingClientRect(), mxp = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, myp = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      var bi = -1, bd = 16; spec.pins.forEach(function (p, i) { var d = Math.hypot(mxp - px(p.x), myp - py(p.y)); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { choice[bi] = 1 - choice[bi]; scoreObj = null; refresh(); }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { choice = spec.start.slice(); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Steiner = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
