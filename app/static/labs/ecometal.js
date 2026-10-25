/* ECO lab: eco-metal (metal-only spare-cell ECO, multi-change).
   After the base (transistor) layers are fabricated, late changes touch only the
   metal and via layers, reusing pre-placed SPARE cells. A real metal-only ECO is a
   batch of small fixes competing for one shared pool of spares set into a design
   that is otherwise full of already-placed, already-connected functional cells. Those
   functional cells cannot be repurposed: their transistors are in use, so only the
   idle spare cells can be re-wired. Three changes share the spare pool here: build an
   AND2 (a spare NAND2 - Not-AND - plus a spare inverter), insert a buffer (one spare
   buffer), and build an OR2 (a spare NOR2 - Not-OR - plus a spare inverter). Each
   spare serves only one change, and the total added metal wire must stay under budget.
   window.EcoMetal = { evaluate, mount }. */
(function () {
  "use strict";
  var BUDGET = 18;
  var SITES = [
    { id: "A", n: 1, x: 2, y: 2, kind: "and", tag: "AND2", need: { NAND2: 1, INV: 1 }, col: "#b45309" },
    { id: "B", n: 2, x: 11, y: 2, kind: "buf", tag: "buffer", need: { BUF: 1 }, col: "#0d9488" },
    { id: "C", n: 3, x: 6, y: 8, kind: "or", tag: "OR2", need: { NOR2: 1, INV: 1 }, col: "#7c3aed" }
  ];
  var SPARES = [
    { id: "s1", type: "NAND2", x: 3, y: 2 }, { id: "s2", type: "INV", x: 2, y: 4 },
    { id: "s3", type: "NOR2", x: 6, y: 6 }, { id: "s4", type: "INV", x: 7, y: 7 },
    { id: "s5", type: "BUF", x: 11, y: 4 }, { id: "s6", type: "NAND2", x: 13, y: 8 },
    { id: "s7", type: "INV", x: 13, y: 1 }, { id: "s8", type: "NOR2", x: 1, y: 7 },
    { id: "s9", type: "BUF", x: 2, y: 1 }
  ];
  /* already-placed functional cells: fixed, not claimable (visual context only) */
  var USED = [
    { type: "DFF", x: 5, y: 2 }, { type: "AOI21", x: 7, y: 3 }, { type: "MUX2", x: 9, y: 3 },
    { type: "NAND3", x: 4, y: 5 }, { type: "INV", x: 9, y: 6 }, { type: "XOR2", x: 10, y: 7 },
    { type: "DFF", x: 3, y: 6 }, { type: "OR2", x: 8, y: 5 }, { type: "BUF", x: 12, y: 6 },
    { type: "NAND2", x: 5, y: 4 }, { type: "AND2", x: 10, y: 5 }, { type: "DFF", x: 8, y: 2 }
  ];
  function man(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function sameCounts(counts, need) {
    var k, tot = 0, ntot = 0;
    for (k in need) { if (counts[k] !== need[k]) return false; ntot += need[k]; }
    for (k in counts) { tot += counts[k]; if (!(k in need)) return false; }
    return tot === ntot;
  }
  function siteById(id) { for (var i = 0; i < SITES.length; i++) if (SITES[i].id === id) return SITES[i]; return null; }
  function analyze(assign) {
    var perSite = {}; SITES.forEach(function (s) { perSite[s.id] = []; });
    SPARES.forEach(function (sp) { var sid = assign[sp.id]; if (sid && perSite[sid]) perSite[sid].push(sp); });
    var rows = [], totalWire = 0, allOK = true;
    SITES.forEach(function (s) {
      var cells = perSite[s.id], counts = {}; cells.forEach(function (c) { counts[c.type] = (counts[c.type] || 0) + 1; });
      var typesOK = sameCounts(counts, s.need), wire = null, gate = null, inv = null, buf = null;
      if (typesOK) {
        if (s.kind === "buf") { buf = cells[0]; wire = 2 * man(s, buf); }
        else {
          gate = cells.filter(function (c) { return c.type !== "INV"; })[0];
          inv = cells.filter(function (c) { return c.type === "INV"; })[0];
          wire = man(s, gate) + man(gate, inv) + man(inv, s);
        }
        totalWire += wire;
      } else allOK = false;
      rows.push({ site: s, cells: cells, typesOK: typesOK, wire: wire, gate: gate, inv: inv, buf: buf });
    });
    var wireOK = allOK && totalWire <= BUDGET;
    return { rows: rows, totalWire: totalWire, allOK: allOK, wireOK: wireOK, pass: allOK && wireOK };
  }
  function evaluate(spec, assign) { return analyze(assign || {}); }

  function mount(container, spec) {
    var COLS = 14, ROWS = 9, cw = 36, ch = 32, ox = 30, oy = 56;
    var W = ox + COLS * cw + 20, Hpx = oy + ROWS * ch + 30, dpr = window.devicePixelRatio || 1;
    var assign = {}, active = SITES[0].id, note = null, submitted = false, scoreObj = null;
    function gx(c) { return ox + c * cw + cw / 2; }
    function gy(r) { return oy + r * ch + ch / 2; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var leftc = document.createElement("div"); leftc.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    leftc.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The block is already placed and wired: the grey <b>hatched</b> cells are functional logic in use and cannot be touched. Only the idle <b>spare cells</b> (green, dashed) can be re-wired, and the fix adds metal wire only. <b>Click a change</b> (the numbered amber sites) to make it active, then <b>click spare cells</b> to wire them in. Site 1 needs an AND2 (a spare <b>NAND2</b> plus an <b>inverter</b>), site 2 a <b>buffer</b>, site 3 an OR2 (a spare <b>NOR2</b> plus an <b>inverter</b>). A spare serves only one change, so the two inverters must be different cells. Keep the <b>total</b> added wire at or under budget (" + BUDGET + ") by claiming spares near each site. Then <b>Submit ECO</b>.";
    leftc.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit ECO";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); leftc.appendChild(ctrls); wrap.appendChild(leftc);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", NEU = "#9aa0aa", SPARE = "#15803d", USEDC = "#a8a29e";
    var hits = [];
    function ortho(ax, ay, bx, by, col, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; if (dash) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(bx, by); ctx.stroke(); if (dash) ctx.setLineDash([]);
    }
    function drawWires(row) {
      var s = row.site, col = s.col, sxp = gx(s.x), syp = gy(s.y);
      if (row.typesOK) {
        if (s.kind === "buf") { var b = row.buf; ortho(sxp, syp, gx(b.x), gy(b.y), col, false); ortho(gx(b.x), gy(b.y), sxp, syp, col, false); }
        else {
          var g = row.gate, i = row.inv;
          ortho(sxp, syp, gx(g.x), gy(g.y), col, false);
          ortho(gx(g.x), gy(g.y), gx(i.x), gy(i.y), col, false);
          ortho(gx(i.x), gy(i.y), sxp, syp, col, false);
        }
      } else { row.cells.forEach(function (c) { ortho(sxp, syp, gx(c.x), gy(c.y), col, true); }); }
    }
    function swatch(x, y, fill, stroke, dash, label) {
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; if (dash) ctx.setLineDash([3, 2]);
      ctx.fillRect(x, y - 6, 16, 12); ctx.strokeRect(x, y - 6, 16, 12); ctx.setLineDash([]);
      ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 22, y);
      return x + 22 + ctx.measureText(label).width + 18;
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* header: active change + legend */
      var as = siteById(active);
      ctx.fillStyle = as.col; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("active change: site " + as.n + " (" + as.tag + ")", ox, 18);
      var lx = ox;
      lx = swatch(lx, 40, "rgba(21,128,61,0.10)", SPARE, true, "spare (usable)");
      lx = swatch(lx, 40, "#efece6", USEDC, false, "in use (fixed)");
      swatch(lx, 40, "rgba(180,83,9,0.12)", "#b45309", false, "change site");
      /* grid */
      ctx.strokeStyle = "#ece9e0"; ctx.lineWidth = 1;
      for (var c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(ox + c * cw, oy); ctx.lineTo(ox + c * cw, oy + ROWS * ch); ctx.stroke(); }
      for (var r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * ch); ctx.lineTo(ox + COLS * cw, oy + r * ch); ctx.stroke(); }
      /* wires under cells */
      res.rows.forEach(drawWires);
      /* used (fixed) functional cells: grey, hatched, locked */
      USED.forEach(function (u) {
        var x = gx(u.x), y = gy(u.y), w = 30, h = 22;
        ctx.fillStyle = "#efece6"; ctx.strokeStyle = USEDC; ctx.lineWidth = 1.2; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.clip();
        ctx.strokeStyle = "rgba(120,113,108,0.35)"; ctx.lineWidth = 1;
        for (var d = -h; d < w; d += 5) { ctx.beginPath(); ctx.moveTo(x - w / 2 + d, y + h / 2); ctx.lineTo(x - w / 2 + d + h, y - h / 2); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = "#78716c"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(u.type, x, y);
        hits.push([x - w / 2, y - h / 2, x + w / 2, y + h / 2, "used"]);
      });
      /* spares: green, dashed if free, owner-coloured solid if claimed */
      SPARES.forEach(function (sp) {
        var x = gx(sp.x), y = gy(sp.y), owner = assign[sp.id], os = owner ? siteById(owner) : null, w = 34, h = 24;
        if (os) { ctx.fillStyle = "rgba(0,0,0,0.02)"; ctx.strokeStyle = os.col; ctx.lineWidth = 2.4; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h); }
        else { ctx.fillStyle = "rgba(21,128,61,0.09)"; ctx.strokeStyle = SPARE; ctx.lineWidth = 1.6; ctx.setLineDash([4, 2]); ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeRect(x - w / 2, y - h / 2, w, h); ctx.setLineDash([]); }
        ctx.fillStyle = os ? os.col : "#166534"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sp.type, x, y - 3);
        ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillStyle = os ? os.col : "#3f9142"; ctx.textBaseline = "top"; ctx.fillText(os ? "→ site " + os.n : "spare", x, y + 6);
        hits.push([x - w / 2, y - h / 2, x + w / 2, y + h / 2, "spare:" + sp.id]);
      });
      /* sites */
      SITES.forEach(function (s) {
        var x = gx(s.x), y = gy(s.y), isActive = s.id === active, row = res.rows[SITES.indexOf(s)];
        if (isActive) { ctx.strokeStyle = s.col; ctx.lineWidth = 2; ctx.setLineDash([2, 2]); ctx.strokeRect(x - 20, y - 16, 40, 32); ctx.setLineDash([]); }
        ctx.fillStyle = "rgba(180,83,9,0.12)"; ctx.strokeStyle = s.col; ctx.lineWidth = isActive ? 2.6 : 1.8; ctx.fillRect(x - 16, y - 13, 32, 26); ctx.strokeRect(x - 16, y - 13, 32, 26);
        ctx.fillStyle = s.col; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(s.n), x, y - 3);
        ctx.font = "7px 'JetBrains Mono', monospace"; ctx.fillText(s.tag, x, y + 8);
        if (row.typesOK) { ctx.fillStyle = OK; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textBaseline = "bottom"; ctx.fillText("✔", x + 21, y - 9); }
        hits.push([x - 16, y - 15, x + 16, y + 15, "site:" + s.id]);
      });
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, Math.min(10000, 10000 - (res.totalWire - 16) * 900))), best = total; try { var key = "mp-best-" + (spec.id || "eco-metal"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function needStr(need) { var a = []; for (var k in need) a.push(need[k] + " " + k); return a.join(" + "); }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "all changes wired, metal-only" : (res.allOK ? "total wire over budget" : "changes not all built")) + '</div>';
      if (note && !submitted) html += '<div class="mp-score"><span class="mp-score-note" style="color:#b45309">' + note + '</span></div>';
      res.rows.forEach(function (row) {
        var s = row.site, det = row.typesOK ? ("built, wire " + row.wire) : (row.cells.length + " cell" + (row.cells.length === 1 ? "" : "s") + ", need " + needStr(s.need));
        html += '<div class="mp-row ' + (row.typesOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (row.typesOK ? "✔" : "✗") + '</span><span class="mp-label">Site ' + s.n + ": " + s.tag + '</span><span class="mp-detail">' + det + '</span></div>';
      });
      html += '<div class="mp-row ' + (res.allOK && res.wireOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.allOK && res.wireOK ? "✔" : "✗") + '</span><span class="mp-label">Total added wire &le; budget</span><span class="mp-detail">' + (res.allOK ? res.totalWire : "-") + " / " + BUDGET + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">All three changes were built from idle spare cells with metal wiring only: the functional cells were left untouched, so no base-layer change and no new mask set. Claiming the spares nearest each site kept the total added wire shortest.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Every change is built and total wire is under budget.</b> Shorter wire scores higher. Click <b>Submit ECO</b>.</div>';
      else if (!res.allOK) html += '<div class="mp-score"><span class="mp-score-note">Build every change from the right spare types. Each spare serves one change only, so the two inverters must be different spare cells.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">All built, but the total added metal wire is too long (' + res.totalWire + ' &gt; ' + BUDGET + '). Reassign to spares closer to each site.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, assign); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) {
          var kind = h[4].split(":")[0], id = h[4].split(":")[1];
          if (kind === "used") { note = "That cell is already used by the design. Its transistors are committed, so it cannot be re-wired. Only the idle spare cells can be claimed for a metal-only ECO."; }
          else if (kind === "site") { active = id; note = null; }
          else { if (assign[id] === active) delete assign[id]; else assign[id] = active; note = null; }
          scoreObj = null; refresh(); break;
        }
      }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { assign = {}; active = SITES[0].id; note = null; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoMetal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
