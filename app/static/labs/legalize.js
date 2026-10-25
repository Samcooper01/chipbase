/* Row legalization lab. Global placement leaves the cells overlapping and off
   the standard-cell rows. The learner drags each cell so it snaps onto a row,
   with no overlap, moving it as little as possible from its global-placement
   spot (the dashed ghost). Peak legality plus a total-displacement budget.
   window.Legalize = { evaluate, mount }. */
(function () {
  "use strict";
  function evaluate(spec, cells) {
    var core = spec.core, R = spec.rowHeight, halo = spec.halo || 1, S = spec.sitePitch || 0;
    var offRow = [], offSite = [], oob = [], ov = [];
    cells.forEach(function (c) {
      var nearest = Math.round(c.y / R) * R;
      if (Math.abs(c.y - nearest) > 0.5) offRow.push(c.id);
      if (S) { var ns = Math.round(c.x / S) * S; if (Math.abs(c.x - ns) > 0.5) offSite.push(c.id); }
      if (c.x < -1e-6 || c.x + c.w > core.w + 1e-6 || c.y < -1e-6 || c.y + c.h > core.h + 1e-6) oob.push(c.id);
    });
    for (var i = 0; i < cells.length; i++) for (var j = i + 1; j < cells.length; j++) {
      var a = cells[i], b = cells[j];
      if (a.x - halo < b.x + b.w && b.x < a.x + a.w + halo && a.y - halo < b.y + b.h && b.y < a.y + a.h + halo) ov.push([a.id, b.id]);
    }
    var disp = 0; cells.forEach(function (c) { disp += Math.abs(c.x - c.x0) + Math.abs(c.y - c.y0); });
    var legal = offRow.length === 0 && offSite.length === 0 && oob.length === 0 && ov.length === 0;
    var dispOK = disp <= spec.dispBudget + 1e-6;
    return { offRow: offRow, offSite: offSite, oob: oob, ov: ov, disp: disp, legal: legal, dispOK: dispOK, pass: legal && dispOK };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 460, R = spec.rowHeight;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var state = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, x: c.x, y: c.y, x0: c.x, y0: c.y, label: c.label || c.id }; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var cap = document.createElement("div"); cap.className = "mp-legend-title"; cap.style.display = "block"; cap.style.margin = "8px 0";
    cap.innerHTML = "Dashed boxes = where <b>global placement</b> left each cell (overlapping, off the rows). Amber leaders show how far you have moved each one - keep it small.";
    left.appendChild(cap);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* site columns (faint) */
      if (spec.sitePitch) { ctx.strokeStyle = "rgba(90,96,110,0.10)"; ctx.lineWidth = 0.5; for (var six = spec.sitePitch; six < core.w; six += spec.sitePitch) { ctx.beginPath(); ctx.moveTo(mx(six), my(0)); ctx.lineTo(mx(six), my(core.h)); ctx.stroke(); } }
      /* row lines */
      ctx.strokeStyle = "rgba(90,96,110,0.35)"; ctx.lineWidth = 1;
      for (var y = 0; y <= core.h + 0.1; y += R) { ctx.beginPath(); ctx.moveTo(mx(0), my(y)); ctx.lineTo(mx(core.w), my(y)); ctx.stroke(); }
      /* global-placement ghosts, filled faintly so the original (overlapping)
         cloud reads as one thing, plus a leader from each cell to its ghost */
      state.forEach(function (c) {
        ctx.fillStyle = "rgba(120,125,135,0.10)"; ctx.fillRect(mx(c.x0), my(c.y0), c.w * sc, c.h * sc);
        ctx.strokeStyle = "rgba(120,125,135,0.55)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.strokeRect(mx(c.x0), my(c.y0), c.w * sc, c.h * sc); ctx.setLineDash([]);
      });
      state.forEach(function (c) {
        if (Math.abs(c.x - c.x0) + Math.abs(c.y - c.y0) < 0.5) return;
        ctx.strokeStyle = "rgba(217,119,6,0.55)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx(c.x0 + c.w / 2), my(c.y0 + c.h / 2)); ctx.lineTo(mx(c.x + c.w / 2), my(c.y + c.h / 2)); ctx.stroke();
      });
      state.forEach(function (c) {
        var X = mx(c.x), Y = my(c.y), Wp = c.w * sc, Hp = c.h * sc;
        var bad = res && (res.offRow.indexOf(c.id) >= 0 || (res.offSite && res.offSite.indexOf(c.id) >= 0) || res.oob.indexOf(c.id) >= 0 || res.ov.some(function (o) { return o[0] === c.id || o[1] === c.id; }));
        ctx.fillStyle = bad ? "rgba(220,38,38,0.2)" : "rgba(37,99,237,0.2)"; ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = bad ? "#dc2626" : "#2f6fed"; ctx.lineWidth = 1.8; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }
    function computeScore(res) {
      var eff = Math.max(0, Math.min(1, (spec.dispBudget - res.disp) / spec.dispBudget));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "legal"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("On row and site, no overlap", res.legal, res.legal ? "legal" : (res.offRow.length ? res.offRow.length + " off-row; " : "") + (res.offSite && res.offSite.length ? res.offSite.length + " off-site; " : "") + (res.ov.length ? res.ov.length + " overlap; " : "") + (res.oob.length ? res.oob.length + " out of bounds" : ""));
      html += row("Displacement in budget", res.dispOK, res.disp.toFixed(0) + " / " + spec.dispBudget);
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Legal with room to spare. Less displacement scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Legal and within budget.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Drag each cell onto a row (it snaps) and shift it sideways off its neighbours. Keep it near its dashed ghost so total displacement stays under budget.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, state); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; } return null; }
    function down(e) { var p = pt(e), m = pick(p); if (m) { drag = { m: m, dx: p[0] - m.x, dy: p[1] - m.y }; scoreObj = null; e.preventDefault(); } }
    function move(e) {
      if (!drag) return; var p = pt(e), m = drag.m;
      var nx = p[0] - drag.dx; if (spec.sitePitch) nx = Math.round(nx / spec.sitePitch) * spec.sitePitch;
      m.x = Math.max(0, Math.min(core.w - m.w, nx));
      m.y = Math.max(0, Math.min(core.h - m.h, Math.round((p[1] - drag.dy) / R) * R));
      refresh(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, x: c.x, y: c.y, x0: c.x, y0: c.y, label: c.label || c.id }; }); scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Legalize = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
