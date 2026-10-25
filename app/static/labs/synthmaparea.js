/* Synthesis lab: synth-map-area (technology mapping for area).
   The subject graph is a real network of primitive gates:
     g1 = AND(a,b), g2 = AND(g1,c), g3 = OR(g2,d), g4 = INV(g3) = out.
   Technology mapping covers this graph with standard-cell library cells so every
   gate is covered exactly once, at the least total area. Each library cell matches a
   real pattern of gates: AND3 covers the two chained ANDs (g1,g2), NOR2 covers the
   OR-then-INV (g3,g4), AOI21 covers the AND-OR-INV run (g2,g3,g4), and so on. The
   least-area cover is AND3 + NOR2 (4 + 2 = 6); the tempting AOI21 leaves g1 stranded
   and totals 7. window.SynthMapArea = { evaluate, mount }. */
(function () {
  "use strict";
  var NODES = ["g1", "g2", "g3", "g4"];
  var MINAREA = 6;
  var MATCHES = [
    { id: "c_g1", cell: "AND2", nodes: ["g1"], area: 3 },
    { id: "c_g2", cell: "AND2", nodes: ["g2"], area: 3 },
    { id: "c_g3", cell: "OR2", nodes: ["g3"], area: 3 },
    { id: "c_g4", cell: "INV", nodes: ["g4"], area: 1 },
    { id: "c_and3", cell: "AND3", nodes: ["g1", "g2"], area: 4 },
    { id: "c_nor2", cell: "NOR2", nodes: ["g3", "g4"], area: 2 },
    { id: "c_aoi", cell: "AOI21", nodes: ["g2", "g3", "g4"], area: 4 }
  ];
  function analyze(sel) {
    var cnt = {}, area = 0; NODES.forEach(function (n) { cnt[n] = 0; });
    MATCHES.forEach(function (m) { if (sel.indexOf(m.id) >= 0) { m.nodes.forEach(function (n) { cnt[n]++; }); area += m.area; } });
    var gaps = NODES.filter(function (n) { return cnt[n] === 0; });
    var overs = NODES.filter(function (n) { return cnt[n] > 1; });
    var valid = gaps.length === 0 && overs.length === 0;
    return { cnt: cnt, area: area, gaps: gaps, overs: overs, valid: valid, pass: valid && area <= MINAREA };
  }
  function evaluate(spec, sel) { return analyze(sel || []); }

  function mount(container, spec) {
    var W = 620, Hpx = 336, dpr = window.devicePixelRatio || 1;
    var sel = [], submitted = false, scoreObj = null;
    var COL = { c_and3: "#0d9488", c_nor2: "#b45309", c_aoi: "#be185d", c_g1: "#2563eb", c_g2: "#2563eb", c_g3: "#2563eb", c_g4: "#2563eb" };
    var NP = { g1: { x: 150, y: 84, op: "AND" }, g2: { x: 236, y: 118, op: "AND" }, g3: { x: 322, y: 152, op: "OR" }, g4: { x: 398, y: 152, op: "INV" } };
    var IN = { a: { x: 46, y: 62 }, b: { x: 46, y: 104 }, c: { x: 46, y: 150 }, d: { x: 46, y: 196 } };

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The circuit on the left is four primitive gates: g1 = AND(a,b), g2 = AND(g1,c), g3 = OR(g2,d), g4 = INV(g3) = out. Cover it with library cells so <b>every gate is covered exactly once</b>, at the <b>least total area</b>. Each cell on the right matches a real pattern of gates: <b>AND3</b> is the two chained ANDs, <b>NOR2</b> is the OR feeding the INV, <b>AOI21</b> is the AND-OR-INV run. A cell that spans several gates is usually cheaper per gate, but the biggest match is not always best: it can leave an awkward gate behind. <b>Click cells</b>, reach the minimum area, then <b>Submit mapping</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit mapping";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280";
    var hits = [];
    function nodeColor(nid, res) {
      if (res.cnt[nid] > 1) return BAD;
      if (res.cnt[nid] === 1) { var owner = MATCHES.filter(function (m) { return sel.indexOf(m.id) >= 0 && m.nodes.indexOf(nid) >= 0; })[0]; return owner ? COL[owner.id] : OK; }
      return null;
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      ctx.strokeStyle = "#9aa0aa"; ctx.lineWidth = 1.4;
      function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - 6, y1); ctx.lineTo(x2 - 6, y2); ctx.lineTo(x2, y2); ctx.stroke(); }
      line(IN.a.x + 12, IN.a.y, NP.g1.x - 24, NP.g1.y - 7); line(IN.b.x + 12, IN.b.y, NP.g1.x - 24, NP.g1.y + 7);
      line(NP.g1.x + 24, NP.g1.y, NP.g2.x - 24, NP.g2.y - 7); line(IN.c.x + 12, IN.c.y, NP.g2.x - 24, NP.g2.y + 7);
      line(NP.g2.x + 24, NP.g2.y, NP.g3.x - 24, NP.g3.y - 7); line(IN.d.x + 12, IN.d.y, NP.g3.x - 24, NP.g3.y + 7);
      ctx.beginPath(); ctx.moveTo(NP.g3.x + 24, NP.g3.y); ctx.lineTo(NP.g4.x - 22, NP.g4.y); ctx.stroke();
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(NP.g4.x + 22, NP.g4.y); ctx.lineTo(NP.g4.x + 48, NP.g4.y); ctx.stroke();
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("out", NP.g4.x + 52, NP.g4.y);
      ["a", "b", "c", "d"].forEach(function (id) { var p = IN[id]; ctx.fillStyle = "#eef1f7"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#1a1d26"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(id, p.x, p.y); });
      NODES.forEach(function (nid) {
        var p = NP[nid], col = nodeColor(nid, res);
        ctx.fillStyle = col ? "rgba(0,0,0,0.03)" : "#eef1f7"; ctx.strokeStyle = col || "#334155"; ctx.lineWidth = col ? 2.4 : 1.6;
        ctx.fillRect(p.x - 24, p.y - 16, 48, 32); ctx.strokeRect(p.x - 24, p.y - 16, 48, 32);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.op, p.x, p.y - 3);
        ctx.fillStyle = MUT; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillText(nid, p.x, p.y + 8);
        if (res.cnt[nid] > 1) { ctx.fillStyle = BAD; ctx.font = "7px 'JetBrains Mono', monospace"; ctx.textBaseline = "bottom"; ctx.fillText("2x", p.x + 20, p.y - 16); }
      });
      /* palette */
      var px = 468, pw = W - px - 12;
      ctx.fillStyle = "#5a606e"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("library cells", px, 44);
      MATCHES.forEach(function (m, i) {
        var y = 50 + i * 38, on = sel.indexOf(m.id) >= 0;
        ctx.fillStyle = on ? "rgba(37,99,237,0.10)" : "#faf9f5"; ctx.strokeStyle = on ? COL[m.id] : "#c9c6bd"; ctx.lineWidth = on ? 2.4 : 1.2;
        ctx.fillRect(px, y, pw, 32); ctx.strokeRect(px, y, pw, 32);
        ctx.fillStyle = COL[m.id]; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(m.cell, px + 8, y + 11);
        ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("covers " + m.nodes.join(",") + " · area " + m.area, px + 8, y + 23);
        hits.push([px, y, px + pw, y + 32, m.id]);
      });
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.area - MINAREA) * 1200)), best = total; try { var key = "mp-best-" + (spec.id || "synth-map-area"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var covered = NODES.filter(function (n) { return res.cnt[n] === 1; }).length;
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "minimum-area cover" : (res.valid ? "valid, but not smallest" : (res.overs.length ? "a gate is double-covered" : "not fully covered"))) + '</div>';
      html += '<div class="mp-row ' + (res.valid ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.valid ? "✔" : "✗") + '</span><span class="mp-label">Every gate covered once</span><span class="mp-detail">' + covered + " / " + NODES.length + '</span></div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Total area</span><span class="mp-detail">' + res.area + " (min " + MINAREA + ")</span></div>";
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">AND3 over the two chained ANDs plus NOR2 over the OR-and-INV covers all four gates for area 6. The big AOI21 looks efficient, but it leaves g1 alone (an AND2), and AOI21 + AND2 totals 7.</div></div>';
      else if (res.valid) html += '<div class="mp-flow mp-flow-ready"><b>Valid cover, area ' + res.area + '.</b> A cheaper combination exists. Which run of gates folds into one cheap cell? Keep trying, or submit.</div>';
      else if (res.overs.length) html += '<div class="mp-score"><span class="mp-score-note">Gates ' + res.overs.join(", ") + ' are covered by two cells at once. Two cells claim the same gate: drop one. Each gate is covered exactly once.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Gates ' + res.gaps.join(", ") + ' are still uncovered. Fill them, then look for a lower-area combination of cells.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, sel); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) { var id = h[4], k = sel.indexOf(id); if (k >= 0) sel.splice(k, 1); else sel.push(id); scoreObj = null; refresh(); break; } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { sel = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthMapArea = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
