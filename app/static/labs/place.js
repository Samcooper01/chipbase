/* Reusable standard-cell placement engine for the Placement topic. The learner
   drags cells to satisfy whichever checks the spec turns on:
   - wirelength : total weighted HPWL under a target
   - timing     : critical nets under their budget
   - density    : no placement bin over its cell-density limit (routability)
   - region     : fenced cells stay inside their region
   Always enforces legality (in bounds, no overlap). window.Place = {evaluate, mount}. */
(function () {
  "use strict";
  function rectsOverlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function evaluate(spec, cells) {
    var core = spec.core, halo = spec.halo != null ? spec.halo : 2;
    var byId = {}; cells.forEach(function (c) { byId[c.id] = c; });
    if (!spec.pinsById) { spec.pinsById = {}; (spec.pins || []).forEach(function (p) { spec.pinsById[p.id] = p; }); }
    var oob = [], ov = [];
    cells.forEach(function (c) { if (c.x < -1e-6 || c.y < -1e-6 || c.x + c.w > core.w + 1e-6 || c.y + c.h > core.h + 1e-6) oob.push(c.id); });
    for (var i = 0; i < cells.length; i++) for (var j = i + 1; j < cells.length; j++) {
      var a = cells[i], b = cells[j];
      if (a.x - halo < b.x + b.w && b.x < a.x + a.w + halo && a.y - halo < b.y + b.h && b.y < a.y + a.h + halo) ov.push([a.id, b.id]);
    }
    function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var m = byId[t.cell]; return [m.x + m.w / 2, m.y + m.h / 2]; }
    var totalHPWL = 0;
    (spec.nets || []).forEach(function (n) {
      var xs = [], ys = []; n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      totalHPWL += (n.weight || 1) * ((Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys)));
    });
    var crit = (spec.nets || []).filter(function (n) { return n.critical; }).map(function (n) {
      var xs = [], ys = []; n.terminals.forEach(function (t) { var p = tp(t); xs.push(p[0]); ys.push(p[1]); });
      var len = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
      return { id: n.id, len: len, budget: n.budget, ok: len <= n.budget + 1e-6 };
    });
    /* density bins */
    var dens = null, maxDens = 0;
    if (spec.density) {
      var B = spec.density.bins, bw = core.w / B, bh = core.h / B, binArea = bw * bh;
      dens = new Array(B * B).fill(0);
      cells.forEach(function (c) {
        var gx0 = Math.max(0, Math.floor(c.x / bw)), gx1 = Math.min(B - 1, Math.floor((c.x + c.w) / bw));
        var gy0 = Math.max(0, Math.floor(c.y / bh)), gy1 = Math.min(B - 1, Math.floor((c.y + c.h) / bh));
        for (var gy = gy0; gy <= gy1; gy++) for (var gx = gx0; gx <= gx1; gx++) {
          var ix = Math.max(c.x, gx * bw), ix1 = Math.min(c.x + c.w, (gx + 1) * bw);
          var iy = Math.max(c.y, gy * bh), iy1 = Math.min(c.y + c.h, (gy + 1) * bh);
          dens[gy * B + gx] += Math.max(0, ix1 - ix) * Math.max(0, iy1 - iy);
        }
      });
      for (var k = 0; k < dens.length; k++) { dens[k] /= binArea; if (dens[k] > maxDens) maxDens = dens[k]; }
    }
    /* region fences: hard fences keep their cells in AND exclude foreign cells
       (exclusive); soft guides only prefer their cells in (spill is allowed) */
    var regionViol = [], exclViol = [], softOut = [];
    if (spec.regions) {
      var rById = {}; spec.regions.forEach(function (r) { rById[r.id] = r; });
      cells.forEach(function (c) {
        if (!c.region) return; var r = rById[c.region];
        var inside = c.x >= r.x - 1e-6 && c.y >= r.y - 1e-6 && c.x + c.w <= r.x + r.w + 1e-6 && c.y + c.h <= r.y + r.h + 1e-6;
        if (!inside) { if (r.type === "soft") softOut.push(c.id); else regionViol.push(c.id); }
      });
      spec.regions.forEach(function (r) {
        if (r.type === "soft") return;                 /* soft guides are not exclusive */
        cells.forEach(function (c) { if (c.region === r.id) return; if (rectsOverlap({ x: c.x, y: c.y, w: c.w, h: c.h }, r)) exclViol.push([c.id, r.id]); });
      });
    }
    /* register clustering (clock-aware): the flops must sit within a small
       span so the clock tree stays short, while data nets pull them apart */
    var regSpan = null, regOK = true, regBox = null;
    if (spec.regSpanLimit != null) {
      var regs = cells.filter(function (c) { return c.reg; });
      if (regs.length) {
        var rminx = Math.min.apply(null, regs.map(function (c) { return c.x; }));
        var rminy = Math.min.apply(null, regs.map(function (c) { return c.y; }));
        var rmaxx = Math.max.apply(null, regs.map(function (c) { return c.x + c.w; }));
        var rmaxy = Math.max.apply(null, regs.map(function (c) { return c.y + c.h; }));
        regBox = { x: rminx, y: rminy, w: rmaxx - rminx, h: rmaxy - rminy };
        regSpan = (rmaxx - rminx) + (rmaxy - rminy);
        regOK = regSpan <= spec.regSpanLimit + 1e-6;
      }
    }
    var legal = oob.length === 0 && ov.length === 0;
    var wlOK = spec.wlTarget == null || totalHPWL <= spec.wlTarget + 1e-6;
    var timingMet = crit.every(function (c) { return c.ok; });
    var densityOK = !spec.density || maxDens <= spec.density.limit + 1e-6;
    var regionOK = regionViol.length === 0 && exclViol.length === 0;
    return {
      oob: oob, ov: ov, totalHPWL: totalHPWL, crit: crit, dens: dens, maxDens: maxDens,
      regionViol: regionViol, exclViol: exclViol, softOut: softOut,
      regSpan: regSpan, regOK: regOK, regBox: regBox,
      legal: legal, wlOK: wlOK, timingMet: timingMet, densityOK: densityOK, regionOK: regionOK,
      pass: legal && wlOK && timingMet && densityOK && regionOK && regOK
    };
  }

  function heatColor(r) { var rr = Math.max(0, r); var hue = 130 * (1 - Math.min(1, rr)); var a = Math.min(0.5, 0.08 + 0.36 * Math.min(1.2, rr)); return "hsla(" + hue.toFixed(0) + ",72%,52%," + a.toFixed(2) + ")"; }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var state = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, x: c.x, y: c.y, label: c.label || c.id, fixed: !!c.fixed, region: c.region, reg: !!c.reg }; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    if (spec.density) { var lg = document.createElement("div"); lg.className = "mp-legend"; lg.innerHTML = '<span class="mp-legend-title">cell-density map (limit ' + (spec.density.limit * 100).toFixed(0) + '%)</span><span class="mp-legend-bar"></span><span class="mp-legend-ends"><span>open</span><span>at limit</span><span>over</span></span>'; left.appendChild(lg); }
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* standard-cell rows and site columns (when the spec is row/site based) */
      if (spec.sitePitch) { ctx.strokeStyle = "rgba(90,96,110,0.10)"; ctx.lineWidth = 0.5; for (var six = spec.sitePitch; six < core.w; six += spec.sitePitch) { ctx.beginPath(); ctx.moveTo(mx(six), my(0)); ctx.lineTo(mx(six), my(core.h)); ctx.stroke(); } }
      if (spec.rowHeight) { ctx.strokeStyle = "rgba(90,96,110,0.3)"; ctx.lineWidth = 0.8; for (var ry = 0; ry <= core.h + 0.1; ry += spec.rowHeight) { ctx.beginPath(); ctx.moveTo(mx(0), my(ry)); ctx.lineTo(mx(core.w), my(ry)); ctx.stroke(); } }
      if (spec.density && res && res.dens) {
        var B = spec.density.bins, bw = core.w / B, bh = core.h / B;
        for (var gy = 0; gy < B; gy++) for (var gx = 0; gx < B; gx++) { ctx.fillStyle = heatColor(res.dens[gy * B + gx] / spec.density.limit); ctx.fillRect(mx(gx * bw), my(gy * bh), bw * sc + 0.7, bh * sc + 0.7); }
      }
      /* region fences: hard = solid red exclusive box, soft = dashed purple guide */
      (spec.regions || []).forEach(function (r) {
        var hard = r.type !== "soft";
        ctx.fillStyle = hard ? "rgba(200,60,50,0.06)" : "rgba(124,58,237,0.06)"; ctx.fillRect(mx(r.x), my(r.y), r.w * sc, r.h * sc);
        ctx.strokeStyle = hard ? "rgba(200,60,50,0.85)" : "rgba(124,58,237,0.75)";
        if (hard) { ctx.setLineDash([]); ctx.lineWidth = 2; } else { ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; }
        ctx.strokeRect(mx(r.x), my(r.y), r.w * sc, r.h * sc); ctx.setLineDash([]);
        ctx.fillStyle = hard ? "rgba(180,40,40,0.9)" : "rgba(124,58,237,0.9)"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
        ctx.fillText((r.label || r.id) + (hard ? " [hard]" : " [soft]"), mx(r.x) + 3, my(r.y) + 12);
      });
      var byId = {}; state.forEach(function (c) { byId[c.id] = c; });
      function tp(t) { if (t.pin) { var p = spec.pinsById[t.pin]; return [p.x, p.y]; } var m = byId[t.cell]; return [m.x + m.w / 2, m.y + m.h / 2]; }
      var critOk = {}; if (res) res.crit.forEach(function (c) { critOk[c.id] = c.ok; });
      (spec.nets || []).forEach(function (n) {
        var pts = n.terminals.map(tp), cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        ctx.strokeStyle = n.critical ? (res ? (critOk[n.id] ? "rgba(21,128,61,0.85)" : "rgba(220,38,38,0.85)") : "rgba(71,85,105,0.7)") : "rgba(90,96,110,0.22)";
        ctx.lineWidth = n.critical ? 2 : 1;
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      (spec.pins || []).forEach(function (p) { ctx.fillStyle = "#374151"; ctx.fillRect(mx(p.x) - 3, my(p.y) - 3, 6, 6); });
      /* register cluster bounding box (clock-aware placement) */
      if (res && res.regBox) {
        ctx.strokeStyle = res.regOK ? "rgba(13,148,136,0.8)" : "rgba(220,38,38,0.8)"; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.6;
        ctx.strokeRect(mx(res.regBox.x), my(res.regBox.y), res.regBox.w * sc, res.regBox.h * sc); ctx.setLineDash([]);
        ctx.fillStyle = res.regOK ? "rgba(13,148,136,0.9)" : "rgba(220,38,38,0.9)"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
        ctx.fillText("clock group", mx(res.regBox.x) + 3, my(res.regBox.y) - 4);
      }
      var rTypeById = {}; (spec.regions || []).forEach(function (r) { rTypeById[r.id] = r.type; });
      state.forEach(function (c) {
        var X = mx(c.x), Y = my(c.y), Wp = c.w * sc, Hp = c.h * sc;
        var excl = res && res.exclViol && res.exclViol.some(function (o) { return o[0] === c.id; });
        var soft = res && res.softOut && res.softOut.indexOf(c.id) >= 0;
        var bad = res && (res.oob.indexOf(c.id) >= 0 || res.ov.some(function (o) { return o[0] === c.id || o[1] === c.id; }) || res.regionViol.indexOf(c.id) >= 0 || excl);
        if (c.fixed) { ctx.fillStyle = "#e7e4db"; ctx.fillRect(X, Y, Wp, Hp); ctx.strokeStyle = "#7b8089"; }
        else {
          var hard = c.region && rTypeById[c.region] !== "soft";
          ctx.fillStyle = bad ? "rgba(220,38,38,0.18)" : soft ? "rgba(217,119,6,0.2)" : c.reg ? "rgba(13,148,136,0.38)" : (c.region ? (hard ? "rgba(200,60,50,0.16)" : "rgba(124,58,237,0.18)") : "rgba(37,99,237,0.16)");
          ctx.fillRect(X, Y, Wp, Hp);
          ctx.strokeStyle = bad ? "#dc2626" : soft ? "#d97706" : c.reg ? "#0d9488" : (c.region ? (hard ? "#c23c32" : "#7c3aed") : "#2f6fed");
        }
        ctx.lineWidth = c.reg && !bad ? 2.6 : 1.6; ctx.strokeRect(X, Y, Wp, Hp);
        /* registers get the classic flip-flop clock-input triangle at the
           bottom-left, so they read as clocked elements at a glance */
        if (c.reg) {
          ctx.fillStyle = bad ? "#dc2626" : "#0d9488"; ctx.beginPath();
          ctx.moveTo(X + 2, Y + Hp - 2); ctx.lineTo(X + 2, Y + Hp - 9); ctx.lineTo(X + 8, Y + Hp - 2); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var wl = spec.parWL ? Math.max(0, Math.min(1, (spec.parWL - res.totalHPWL) / (spec.parWL * 0.4))) : 0.5;
      var total = Math.round(4000 + 6000 * wl);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "place"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      if (spec.wlTarget != null) html += row("Wirelength under target", res.wlOK, res.totalHPWL.toFixed(0) + " / " + spec.wlTarget);
      if (res.crit.length) html += row("Timing closes", res.timingMet, res.crit.filter(function (c) { return c.ok; }).length + " / " + res.crit.length + " nets");
      if (spec.density) html += row("Density under limit", res.densityOK, (res.maxDens * 100).toFixed(0) + "% / " + (spec.density.limit * 100).toFixed(0) + "%");
      if (spec.regions) {
        var hasHard = spec.regions.some(function (r) { return r.type !== "soft"; });
        var hasSoft = spec.regions.some(function (r) { return r.type === "soft"; });
        if (hasHard) html += row("Hard fences respected", res.regionOK, res.regionOK ? "assigned cells in, others out" : (res.regionViol.length ? res.regionViol.length + " assigned outside; " : "") + (res.exclViol.length ? res.exclViol.length + " foreign inside" : ""));
        if (hasSoft) html += '<div class="mp-row ' + (res.softOut.length ? "" : "mp-ok") + '"><span class="mp-mark">' + (res.softOut.length ? "○" : "✔") + '</span><span class="mp-label">Soft guide (preference)</span><span class="mp-detail">' + (res.softOut.length ? res.softOut.length + " spilled (allowed)" : "all in guide") + '</span></div>';
      }
      if (spec.regSpanLimit != null) html += row("Registers clustered", res.regOK, res.regSpan != null ? res.regSpan.toFixed(0) + " span / " + spec.regSpanLimit + " max" : "n/a");
      html += row("Legality", res.legal, res.legal ? "in bounds, no overlap" : (res.oob.length ? res.oob.length + " out of bounds; " : "") + (res.ov.length ? res.ov.length + " overlap" : ""));
      if (res.crit.length) { html += '<div class="mp-crit-head">critical nets</div>'; res.crit.forEach(function (c) { html += '<div class="mp-crit ' + (c.ok ? "mp-ok" : "mp-bad") + '">' + c.id + ': ' + c.len.toFixed(0) + ' / ' + c.budget + '</div>'; }); }
      if (spec.wlTarget == null) html += '<div class="mp-score">total wirelength <b>' + res.totalHPWL.toFixed(0) + '</b></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Passing. Shorter wirelength scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All checks pass.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "Pull connected cells together to shorten the nets.") + '</span></div>';
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, state); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    var drag = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (!m.fixed && p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; } return null; }
    function down(e) { var p = pt(e), m = pick(p); if (m) { drag = { m: m, dx: p[0] - m.x, dy: p[1] - m.y }; scoreObj = null; e.preventDefault(); } }
    function move(e) {
      if (!drag) return; var p = pt(e), m = drag.m;
      var nx = p[0] - drag.dx, ny = p[1] - drag.dy;
      if (spec.sitePitch) nx = Math.round(nx / spec.sitePitch) * spec.sitePitch;   /* snap to site column */
      if (spec.rowHeight) ny = Math.round(ny / spec.rowHeight) * spec.rowHeight;    /* snap to row */
      m.x = Math.max(0, Math.min(core.w - m.w, nx)); m.y = Math.max(0, Math.min(core.h - m.h, ny));
      refresh(); e.preventDefault();
    }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state = spec.cells.map(function (c) { return { id: c.id, w: c.w, h: c.h, x: c.x, y: c.y, label: c.label || c.id, fixed: !!c.fixed, region: c.region, reg: !!c.reg }; }); scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Place = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
