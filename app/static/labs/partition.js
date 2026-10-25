/* Hierarchical partitioning (min-cut) lab. The die is split into regions; the
   learner drags blocks into the regions to minimize the number of nets CUT
   across region boundaries, while keeping the regions balanced. A net is cut
   when its blocks do not all sit in one region.
   window.Partition = { evaluate, mount }. */
(function () {
  "use strict";
  function rectsOverlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  function regionOf(spec, b) {
    var i = Math.floor((b.x + b.w / 2) / (spec.core.w / spec.regions));
    return Math.max(0, Math.min(spec.regions - 1, i));
  }

  function evaluate(spec, blocks) {
    var core = spec.core, halo = spec.halo || 3;
    var byId = {}; blocks.forEach(function (b) { byId[b.id] = b; });
    var oob = [], ov = [];
    blocks.forEach(function (b) { if (b.x < -1e-6 || b.y < -1e-6 || b.x + b.w > core.w + 1e-6 || b.y + b.h > core.h + 1e-6) oob.push(b.id); });
    for (var i = 0; i < blocks.length; i++) for (var j = i + 1; j < blocks.length; j++) {
      var a = blocks[i], c = blocks[j];
      if (a.x - halo < c.x + c.w && c.x < a.x + a.w + halo && a.y - halo < c.y + c.h && c.y < a.y + a.h + halo) ov.push([a.id, c.id]);
    }
    var reg = {}; blocks.forEach(function (b) { reg[b.id] = regionOf(spec, b); });
    var area = new Array(spec.regions).fill(0);
    blocks.forEach(function (b) { area[reg[b.id]] += b.w * b.h; });
    var cut = 0, cutIds = {};
    (spec.nets || []).forEach(function (n, idx) {
      var rs = {}; n.terminals.forEach(function (t) { rs[reg[t.block]] = 1; });
      if (Object.keys(rs).length > 1) { cut++; cutIds[idx] = 1; }
    });
    var maxA = Math.max.apply(null, area), minA = Math.min.apply(null, area), total = maxA + minA || 1;
    var imbalance = (maxA - minA) / (area.reduce(function (s, a) { return s + a; }, 0) / spec.regions);
    var balanceOK = imbalance <= (spec.balanceTol != null ? spec.balanceTol : 0.25);
    var legal = oob.length === 0 && ov.length === 0;
    var cutOK = cut <= spec.cutTarget;
    return {
      reg: reg, area: area, cut: cut, cutIds: cutIds, imbalance: imbalance,
      oob: oob, ov: ov, legal: legal, balanceOK: balanceOK, cutOK: cutOK,
      pass: legal && balanceOK && cutOK
    };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id }; });
    var scoreObj = null;
    var REGCOL = ["rgba(37,99,235,", "rgba(217,119,6,", "rgba(124,58,237,"];

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      var rw = core.w / spec.regions;
      for (var r = 0; r < spec.regions; r++) {
        ctx.fillStyle = REGCOL[r % REGCOL.length] + "0.06)"; ctx.fillRect(mx(r * rw), my(0), rw * sc, core.h * sc);
        if (r > 0) { ctx.strokeStyle = "rgba(26,29,38,0.5)"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mx(r * rw), my(0)); ctx.lineTo(mx(r * rw), my(core.h)); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = "rgba(26,29,38,0.5)"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
        ctx.fillText((spec.regionNames && spec.regionNames[r]) || ("region " + (r + 1)), mx((r + 0.5) * rw), my(0) + 14);
      }
      var byId = {}; state.forEach(function (b) { byId[b.id] = b; });
      /* nets: cut ones red and bold, internal faint */
      (spec.nets || []).forEach(function (n, idx) {
        var pts = n.terminals.map(function (t) { var m = byId[t.block]; return [m.x + m.w / 2, m.y + m.h / 2]; });
        var cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        var isCut = res && res.cutIds[idx];
        ctx.strokeStyle = isCut ? "rgba(220,38,38,0.85)" : "rgba(90,96,110,0.22)"; ctx.lineWidth = isCut ? 2 : 1;
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      /* blocks colored by their region */
      state.forEach(function (b) {
        var r = res ? res.reg[b.id] : regionOf(spec, b);
        var bad = res && (res.oob.indexOf(b.id) >= 0 || res.ov.some(function (o) { return o[0] === b.id || o[1] === b.id; }));
        var X = mx(b.x), Y = my(b.y), Wp = b.w * sc, Hp = b.h * sc;
        ctx.fillStyle = bad ? "rgba(220,38,38,0.18)" : (REGCOL[r % REGCOL.length] + "0.2)");
        ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = bad ? "#dc2626" : (REGCOL[r % REGCOL.length] + "0.95)").replace("rgba", "rgba"); ctx.lineWidth = 2; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var cutScore = Math.max(0, Math.min(1, (spec.cutMax - res.cut) / Math.max(1, spec.cutMax - spec.cutTarget)));
      var bal = Math.max(0, 1 - res.imbalance / (spec.balanceTol || 0.25));
      var total = Math.round(3000 + 5000 * cutScore + 2000 * bal);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "part"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Cut nets at or under target", res.cutOK, res.cut + " cut / " + spec.cutTarget + " target");
      html += row("Regions balanced", res.balanceOK, (res.imbalance * 100).toFixed(0) + "% imbalance / " + ((spec.balanceTol || 0.25) * 100).toFixed(0) + "% max");
      html += row("Legality", res.legal, res.legal ? "in bounds, no overlap" : (res.oob.length ? res.oob.length + " out of bounds; " : "") + (res.ov.length ? res.ov.length + " overlap" : ""));
      html += '<div class="mp-crit-head">region areas</div>';
      res.area.forEach(function (a, r) { html += '<div class="mp-crit">' + ((spec.regionNames && spec.regionNames[r]) || ("region " + (r + 1))) + ': ' + a.toFixed(0) + '</div>'; });
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Balanced and under target. Fewer cuts scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Under target and balanced.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Group the tightly-connected blocks into the same region. Red nets cross the boundary. Keep the regions roughly equal in area.</span></div>';
      panel.innerHTML = html;
    }

    var last = null;
    function refresh() { last = evaluate(spec, state); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }

    var drag = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); return [((e.touches ? e.touches[0].clientX : e.clientX) - r.left - PAD) / sc, ((e.touches ? e.touches[0].clientY : e.clientY) - r.top - PAD) / sc]; }
    function pick(p) { for (var i = state.length - 1; i >= 0; i--) { var m = state[i]; if (p[0] >= m.x && p[0] <= m.x + m.w && p[1] >= m.y && p[1] <= m.y + m.h) return m; } return null; }
    function down(e) { var p = pt(e), m = pick(p); if (m) { drag = { m: m, dx: p[0] - m.x, dy: p[1] - m.y }; scoreObj = null; e.preventDefault(); } }
    function move(e) { if (!drag) return; var p = pt(e), m = drag.m; m.x = Math.max(0, Math.min(core.w - m.w, p[0] - drag.dx)); m.y = Math.max(0, Math.min(core.h - m.h, p[1] - drag.dy)); refresh(); e.preventDefault(); }
    function up() { drag = null; }
    canvas.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id }; }); scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Partition = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
