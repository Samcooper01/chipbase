/* Voltage-domain floorplanning lab. Every block belongs to a fixed voltage
   domain. Each domain must occupy its own contiguous region (domains may not
   interleave), and the few nets that cross between domains (which need level
   shifters) must stay short, so the domains sit adjacent with their
   communicating blocks near the shared boundary.
   window.VDomain = { evaluate, mount }. */
(function () {
  "use strict";
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  function evaluate(spec, blocks) {
    var core = spec.core, halo = spec.halo || 3;
    var byId = {}; blocks.forEach(function (b) { byId[b.id] = b; });
    var oob = [], ov = [];
    blocks.forEach(function (b) { if (b.x < -1e-6 || b.y < -1e-6 || b.x + b.w > core.w + 1e-6 || b.y + b.h > core.h + 1e-6) oob.push(b.id); });
    for (var i = 0; i < blocks.length; i++) for (var j = i + 1; j < blocks.length; j++) {
      var a = blocks[i], c = blocks[j];
      if (a.x - halo < c.x + c.w && c.x < a.x + a.w + halo && a.y - halo < c.y + c.h && c.y < a.y + a.h + halo) ov.push([a.id, c.id]);
    }
    /* per-domain bounding box */
    var doms = spec.domains.map(function (d) { return d.id; });
    var bbox = {};
    doms.forEach(function (d) {
      var bs = blocks.filter(function (b) { return b.domain === d; });
      if (!bs.length) return;
      var x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })), y0 = Math.min.apply(null, bs.map(function (b) { return b.y; }));
      var x1 = Math.max.apply(null, bs.map(function (b) { return b.x + b.w; })), y1 = Math.max.apply(null, bs.map(function (b) { return b.y + b.h; }));
      bbox[d] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
    /* domains must occupy disjoint regions (contiguous, not interleaved) */
    var domOverlap = [];
    for (var p = 0; p < doms.length; p++) for (var q = p + 1; q < doms.length; q++) {
      if (bbox[doms[p]] && bbox[doms[q]] && overlap(bbox[doms[p]], bbox[doms[q]])) domOverlap.push([doms[p], doms[q]]);
    }
    /* cross-domain nets need level shifters; keep them short */
    var crossWL = 0, crossIds = {}, shifters = 0;
    (spec.nets || []).forEach(function (n, idx) {
      var ds = {}; n.terminals.forEach(function (t) { ds[byId[t.block].domain] = 1; });
      if (Object.keys(ds).length > 1) {
        shifters++;
        var xs = n.terminals.map(function (t) { return byId[t.block].x + byId[t.block].w / 2; });
        var ys = n.terminals.map(function (t) { return byId[t.block].y + byId[t.block].h / 2; });
        crossWL += (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + (Math.max.apply(null, ys) - Math.min.apply(null, ys));
        crossIds[idx] = 1;
      }
    });
    var legal = oob.length === 0 && ov.length === 0;
    var sepOK = domOverlap.length === 0;
    var wlOK = crossWL <= spec.crossBudget;
    return {
      bbox: bbox, oob: oob, ov: ov, domOverlap: domOverlap, crossIds: crossIds, crossWL: crossWL, shifters: shifters,
      legal: legal, sepOK: sepOK, wlOK: wlOK, pass: legal && sepOK && wlOK
    };
  }

  function mount(container, spec) {
    var core = spec.core, PAD = 20, MAXPX = 460;
    var sc = MAXPX / Math.max(core.w, core.h);
    var W = core.w * sc + PAD * 2, Hpx = core.h * sc + PAD * 2;
    function mx(x) { return PAD + x * sc; } function my(y) { return PAD + y * sc; }
    var domById = {}; spec.domains.forEach(function (d) { domById[d.id] = d; });
    var state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id, domain: b.domain }; });
    var scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var legend = document.createElement("div"); legend.className = "mp-legend"; legend.style.flexDirection = "row"; legend.style.gap = "14px";
    legend.innerHTML = spec.domains.map(function (d) { return '<span style="font-size:11px;color:' + d.color + ';font-weight:700">■ ' + d.name + '</span>'; }).join("");
    left.appendChild(legend);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(mx(0), my(0), core.w * sc, core.h * sc);
      /* domain regions (bounding boxes), red border if two domains overlap */
      spec.domains.forEach(function (d) {
        var bb = res && res.bbox[d.id]; if (!bb) return;
        var bad = res.domOverlap.some(function (o) { return o.indexOf(d.id) >= 0; });
        ctx.fillStyle = d.color.replace("rgb", "rgba").replace(")", ",0.08)");
        ctx.fillRect(mx(bb.x), my(bb.y), bb.w * sc, bb.h * sc);
        ctx.strokeStyle = bad ? "#dc2626" : d.color; ctx.setLineDash(bad ? [] : [6, 4]); ctx.lineWidth = bad ? 2.4 : 1.4;
        ctx.strokeRect(mx(bb.x), my(bb.y), bb.w * sc, bb.h * sc); ctx.setLineDash([]);
      });
      var byId = {}; state.forEach(function (b) { byId[b.id] = b; });
      (spec.nets || []).forEach(function (n, idx) {
        var pts = n.terminals.map(function (t) { var m = byId[t.block]; return [m.x + m.w / 2, m.y + m.h / 2]; });
        var cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, cy = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
        var isCross = res && res.crossIds[idx];
        ctx.strokeStyle = isCross ? "rgba(220,38,38,0.85)" : "rgba(90,96,110,0.2)"; ctx.lineWidth = isCross ? 2 : 1;
        pts.forEach(function (p) { ctx.beginPath(); ctx.moveTo(mx(cx), my(cy)); ctx.lineTo(mx(p[0]), my(p[1])); ctx.stroke(); });
      });
      state.forEach(function (b) {
        var d = domById[b.domain], X = mx(b.x), Y = my(b.y), Wp = b.w * sc, Hp = b.h * sc;
        var bad = res && (res.oob.indexOf(b.id) >= 0 || res.ov.some(function (o) { return o[0] === b.id || o[1] === b.id; }));
        ctx.fillStyle = bad ? "rgba(220,38,38,0.2)" : d.color.replace("rgb", "rgba").replace(")", ",0.26)");
        ctx.fillRect(X, Y, Wp, Hp);
        ctx.strokeStyle = bad ? "#dc2626" : d.color; ctx.lineWidth = 2; ctx.strokeRect(X, Y, Wp, Hp);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(b.label, X + Wp / 2, Y + Hp / 2); ctx.textBaseline = "alphabetic";
      });
      ctx.strokeStyle = "#1a1d26"; ctx.lineWidth = 1.6; ctx.strokeRect(mx(0), my(0), core.w * sc, core.h * sc);
    }

    function computeScore(res) {
      var wl = Math.max(0, Math.min(1, (spec.crossBudget - res.crossWL) / spec.crossBudget));
      var total = Math.round(4000 + 6000 * wl);
      var best = total;
      try { var key = "mp-best-" + (spec.id || "vdom"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function row(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += row("Domains kept separate", res.sepOK, res.sepOK ? "no domain overlap" : res.domOverlap.length + " domains overlap");
      html += row("Level-shifter nets short", res.wlOK, "cross-domain wire " + res.crossWL.toFixed(0) + " / " + spec.crossBudget);
      html += row("Legality", res.legal, res.legal ? "in bounds, no overlap" : (res.oob.length ? res.oob.length + " out of bounds; " : "") + (res.ov.length ? res.ov.length + " overlap" : ""));
      html += '<div class="mp-crit-head">' + res.shifters + ' cross-domain nets (each needs a level shifter)</div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Domains separated and crossings short. Shorter cross-domain wire scores higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Domains clean and crossings short.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Group each colour into its own region (no overlap between the dashed boxes), and put the blocks on the red cross-domain nets near the shared boundary.</span></div>';
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
    bReset.addEventListener("click", function () { state = spec.blocks.map(function (b) { return { id: b.id, w: b.w, h: b.h, x: b.x, y: b.y, label: b.label || b.id, domain: b.domain }; }); scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.VDomain = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
