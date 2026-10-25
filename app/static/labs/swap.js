/* Detailed-placement cell-swapping lab. Many variable-width cells are packed
   left-to-right across the rows in a fixed ORDER. The learner CLICKS two cells
   to swap their order; the row re-packs and the wirelength updates. Reorder so
   connected cells end up adjacent and the total wirelength drops under target.
   window.Swap = { evaluate, mount }. */
(function () {
  "use strict";
  function pack(spec, order) {
    var x = 0, row = 0, gap = spec.gap != null ? spec.gap : 2, R = spec.rowHeight, y0 = spec.rowStartY || 0;
    var pos = {};
    order.forEach(function (c) {
      if (x + c.w > spec.core.w + 1e-6) { row++; x = 0; }
      pos[c.id] = [x, y0 + row * R, row];
      x += c.w + gap;
    });
    return { pos: pos, rows: row + 1 };
  }
  function evaluate(spec, order) {
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var pk = pack(spec, order), pos = pk.pos, byId = {}; order.forEach(function (c) { byId[c.id] = c; });
    function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var c = byId[t.cell]; return [pos[c.id][0] + c.w / 2, pos[c.id][1] + c.h / 2]; }
    var totalHPWL = 0;
    (spec.nets || []).forEach(function (n) {
      var xs = [], ys = []; n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      totalHPWL += (n.weight || 1) * ((Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys)));
    });
    var fits = pk.rows * spec.rowHeight <= spec.core.h + 1e-6;
    return { totalHPWL: totalHPWL, pos: pos, rows: pk.rows, fits: fits, wlOK: totalHPWL <= spec.wlTarget + 1e-6, pass: fits && totalHPWL <= spec.wlTarget + 1e-6 };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 480;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var order = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, label: c.label || c.id }; });
    var sel = null, scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0";
    hint.textContent = "Click one cell, then another, to swap their order. The row re-packs and the wirelength updates.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var lastPos = {};
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* row guides */
      ctx.strokeStyle = "rgba(90,96,110,0.25)"; ctx.lineWidth = 1;
      for (var ry = (spec.rowStartY || 0); ry <= core.h + 0.1; ry += spec.rowHeight) { ctx.beginPath(); ctx.moveTo(mx(0), my(ry)); ctx.lineTo(mx(core.w), my(ry)); ctx.stroke(); }
      var pos = res.pos; lastPos = pos;
      var byId = {}; order.forEach(function (c) { byId[c.id] = c; });
      function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var c = byId[t.cell]; return [pos[c.id][0] + c.w / 2, pos[c.id][1] + c.h / 2]; }
      (spec.nets || []).forEach(function (n) {
        var pts = n.terminals.map(tp), cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        ctx.strokeStyle = "rgba(90,96,110,0.35)"; ctx.lineWidth = 1;
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      (spec.pins || []).forEach(function (p) { ctx.fillStyle = "#374151"; ctx.fillRect(mx(p.x) - 3, my(p.y) - 3, 6, 6); ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(p.id, mx(p.x) + (p.x <= 1 ? 10 : p.x >= core.w - 1 ? -10 : 0), my(p.y) - 6); });
      order.forEach(function (c) {
        var pp = pos[c.id], X = mx(pp[0]), Y = my(pp[1]), Wp = c.w * sc, Hp = c.h * sc, isSel = sel === c.id;
        ctx.fillStyle = isSel ? "rgba(217,119,6,0.32)" : "rgba(37,99,237,0.2)"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = isSel ? "#d97706" : "#2f6fed"; ctx.lineWidth = isSel ? 2.6 : 1.6; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = spec.parWL ? Math.max(0, Math.min(1, (spec.parWL * 1.3 - res.totalHPWL) / (spec.parWL * 0.3))) : 0.5;
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "swap"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.wlOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.wlOK ? "✔" : "✗") + '</span><span class="mp-label">Wirelength under target</span><span class="mp-detail">' + res.totalHPWL.toFixed(0) + " / " + spec.wlTarget + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Under target. Fewer/shorter wires score higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under target.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Swap cells so the ones that share a net sit next to each other (and the chain runs in order toward its end pins), shrinking the total wire.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, order); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = 0; i < order.length; i++) { var c = order[i], pp = lastPos[c.id]; if (pp && p[0] >= pp[0] && p[0] <= pp[0] + c.w && p[1] >= pp[1] && p[1] <= pp[1] + c.h) return c.id; } return null; }
    function tap(e) {
      var id = pick(pt(e)); if (!id) { sel = null; draw(last); e.preventDefault(); return; }
      if (sel === null) sel = id;
      else if (sel === id) sel = null;
      else { var i = order.findIndex(function (c) { return c.id === sel; }), j = order.findIndex(function (c) { return c.id === id; }); var t = order[i]; order[i] = order[j]; order[j] = t; sel = null; scoreObj = null; }
      refresh(); e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { order = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, label: c.label || c.id }; }); sel = null; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Swap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
