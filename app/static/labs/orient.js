/* Macro orientation and pin-access lab. Each macro has its pins on ONE edge.
   The macros are fixed in place; you CLICK a macro to rotate it (cycling the
   pin edge N -> E -> S -> W) so its pins face what it connects to. A pin
   facing away from its target makes the wire wrap around the macro, blowing the
   net's budget. window.Orient = { evaluate, mount }. */
(function () {
  "use strict";
  var EDGES = ["N", "E", "S", "W"];
  function pinPoint(m) {
    if (m.edge === "N") return [m.x + m.w / 2, m.y];
    if (m.edge === "E") return [m.x + m.w, m.y + m.h / 2];
    if (m.edge === "S") return [m.x + m.w / 2, m.y + m.h];
    return [m.x, m.y + m.h / 2];   /* W */
  }

  function evaluate(spec, macros) {
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var byId = {}; macros.forEach(function (m) { byId[m.id] = m; });
    function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } return pinPoint(byId[t.macro]); }
    var crit = (spec.nets || []).filter(function (n) { return n.critical; }).map(function (n) {
      var xs = [], ys = [];
      n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      var len = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
      return { id: n.id, len: len, budget: n.budget, ok: len <= n.budget + 1e-6 };
    });
    var totalWL = (spec.nets || []).reduce(function (s, n) {
      var xs = [], ys = []; n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      return s + (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
    }, 0);
    var timingMet = crit.every(function (c) { return c.ok; });
    return { crit: crit, timingMet: timingMet, totalWL: totalWL, pass: timingMet };
  }

  function mount(container, spec) {
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var core = spec.core, PAD = 22, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var state = spec.macros.map(function (m) { return { id: m.id, w: m.w, h: m.h, x: m.x, y: m.y, label: m.label || m.id, edge: m.edge || "N" }; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.textContent = "Click a macro to rotate its pin edge (N → E → S → W).";
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
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
      var byId = {}; state.forEach(function (m) { byId[m.id] = m; });
      function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } return pinPoint(byId[t.macro]); }
      var critOk = {}; if (res) res.crit.forEach(function (c) { critOk[c.id] = c.ok; });
      (spec.nets || []).forEach(function (n) {
        var pts = n.terminals.map(tp);
        ctx.strokeStyle = n.critical ? (res ? (critOk[n.id] ? "rgba(21,128,61,0.9)" : "rgba(220,38,38,0.9)") : "rgba(71,85,105,0.7)") : "rgba(90,96,110,0.3)";
        ctx.lineWidth = n.critical ? 2 : 1;
        for (var i = 1; i < pts.length; i++) { ctx.beginPath(); ctx.moveTo(mx(pts[0][0]), my(pts[0][1])); ctx.lineTo(mx(pts[i][0]), my(pts[i][1])); ctx.stroke(); }
      });
      /* boundary pins */
      (spec.pins || []).forEach(function (p) {
        ctx.fillStyle = "#374151"; ctx.fillRect(mx(p.x) - 3, my(p.y) - 3, 6, 6);
        ctx.font = "10px 'JetBrains Mono', monospace"; ctx.fillStyle = "#374151"; ctx.textAlign = "center";
        ctx.fillText(p.id, mx(p.x) + (p.x <= 1 ? 12 : p.x >= core.w - 1 ? -12 : 0), my(p.y) + (p.y <= 1 ? 12 : p.y >= core.h - 1 ? -6 : -8));
      });
      /* macros with a thick pin bar on the current edge */
      state.forEach(function (m) {
        var X = mx(m.x), Y = my(m.y), Wp = m.w * sc, Hp = m.h * sc;
        ctx.fillStyle = "rgba(37,99,237,0.16)"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = "#2f6fed"; ctx.lineWidth = 2; ctx.strokeRect(X, Y, Wp, Hp);
        /* pin bar */
        ctx.strokeStyle = "#d97706"; ctx.lineWidth = 4;
        ctx.beginPath();
        if (m.edge === "N") { ctx.moveTo(X + 3, Y); ctx.lineTo(X + Wp - 3, Y); }
        else if (m.edge === "E") { ctx.moveTo(X + Wp, Y + 3); ctx.lineTo(X + Wp, Y + Hp - 3); }
        else if (m.edge === "S") { ctx.moveTo(X + 3, Y + Hp); ctx.lineTo(X + Wp - 3, Y + Hp); }
        else { ctx.moveTo(X, Y + 3); ctx.lineTo(X, Y + Hp - 3); }
        ctx.stroke();
        ctx.fillStyle = "#1d4ed8"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.label, X + Wp / 2, Y + Hp / 2);
        ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillStyle = "#d97706"; ctx.fillText("pins " + m.edge, X + Wp / 2, Y + Hp / 2 + 11);
        ctx.textBaseline = "alphabetic";
      });
    }

    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.parWL - res.totalWL) / (spec.parWL * 0.4)));
      var total = Math.round(4000 + 6000 * eff);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "orient"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.timingMet ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.timingMet ? "✔" : "✗") + '</span><span class="mp-label">All pins reach their target in budget</span><span class="mp-detail">' + res.crit.filter(function (c) { return c.ok; }).length + " / " + res.crit.length + '</span></div>';
      html += '<div class="mp-crit-head">nets</div>';
      res.crit.forEach(function (c) { html += '<div class="mp-crit ' + (c.ok ? "mp-ok" : "mp-bad") + '">' + c.id + ': ' + c.len.toFixed(0) + ' / ' + c.budget + '</div>'; });
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Every pin faces its target. Shorter total wire scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every pin reaches its target.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">A red net means that macro\'s pins (orange bar) face away from what it connects to, so the wire wraps around it. Rotate the macro until the pin bar faces its target.</span></div>';
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, state); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; } return null; }
    function tap(e) { var m = pick(pt(e)); if (m) { m.edge = EDGES[(EDGES.indexOf(m.edge) + 1) % 4]; scoreObj = null; refresh(); e.preventDefault(); } }
    canvas.addEventListener("mousedown", tap);
    canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state = spec.macros.map(function (m) { return { id: m.id, w: m.w, h: m.h, x: m.x, y: m.y, label: m.label || m.id, edge: m.edge || "N" }; }); scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Orient = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
