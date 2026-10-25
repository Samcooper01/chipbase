/* ECO lab: eco-legal (placement ECO and legalization, multi-row die).
   After an ECO inserts new cells, a placer drops them at their ideal position (where
   timing and wirelength want them). On a real die that lands them on top of cells
   that are already placed, on rows that may be full, so the layout is illegal. This
   lab starts in exactly that state: all the ECO cells sit at their ideal spots,
   overlapping fixed cells, all illegal. LEGALIZATION snaps every cell to a legal
   spot: inside some standard-cell row, aligned to the site grid, not overlapping
   anything, moving each cell as LITTLE as possible from its ideal, because
   displacement erodes the timing and wirelength the placer chose. On a packed die
   the nearest legal gap is often in an ADJACENT row, so displacement counts vertical
   movement too. window.EcoLegal = { evaluate, mount }. */
(function () {
  "use strict";
  var R = 7, C = 20, ROWCOST = 3, BUDGET = 10;
  var FREE = [[0, 2, 4], [0, 15, 16], [1, 5, 7], [1, 12, 12], [2, 0, 1], [2, 9, 10], [3, 17, 19], [4, 9, 11], [4, 3, 3], [5, 6, 7], [5, 13, 14], [6, 0, 2], [6, 18, 19]];
  var freeSet = {}; FREE.forEach(function (g) { for (var c = g[1]; c <= g[2]; c++) freeSet[g[0] + "," + c] = true; });
  function isFree(r, c) { return !!freeSet[r + "," + c]; }
  var CELLS = [
    { id: "C1", label: "new NAND2", w: 2, ir: 3, il: 9, col: "#0d9488" },
    { id: "C2", label: "new INV", w: 3, ir: 1, il: 3, col: "#7c3aed" },
    { id: "C3", label: "new BUF", w: 2, ir: 5, il: 4, col: "#b45309" },
    { id: "C4", label: "new AND2", w: 2, ir: 6, il: 16, col: "#2563eb" }
  ];
  function idealPlacements() { var p = {}; CELLS.forEach(function (c) { p[c.id] = { row: c.ir, left: c.il }; }); return p; }
  function legality(cell, pos, blocked) {
    if (!pos) return { placed: false, ok: false };
    var r = pos.row, left = pos.left;
    if (left < 0 || left + cell.w > C || r < 0 || r >= R) return { placed: true, ok: false, reason: "offrow" };
    for (var c = left; c < left + cell.w; c++) {
      if (!isFree(r, c)) return { placed: true, ok: false, reason: "fixed" };
      if (blocked[r + "," + c]) return { placed: true, ok: false, reason: "eco" };
    }
    return { placed: true, ok: true };
  }
  function analyze(placements) {
    var rows = [], total = 0, allOK = true;
    CELLS.forEach(function (cell) {
      /* sites occupied by every OTHER eco cell */
      var blocked = {};
      CELLS.forEach(function (o) { if (o.id === cell.id) return; var p = placements[o.id]; if (p) for (var c = p.left; c < p.left + o.w; c++) blocked[p.row + "," + c] = true; });
      var pos = placements[cell.id], leg = legality(cell, pos, blocked);
      var disp = leg.placed ? Math.abs(pos.left - cell.il) + ROWCOST * Math.abs(pos.row - cell.ir) : null;
      if (!leg.ok) allOK = false; else total += disp;
      rows.push({ cell: cell, pos: pos, placed: leg.placed, ok: leg.ok, reason: leg.reason, disp: disp });
    });
    var budgetOK = allOK && total <= BUDGET;
    return { rows: rows, total: total, allOK: allOK, budgetOK: budgetOK, pass: allOK && budgetOK };
  }
  function evaluate(spec, placements) { return analyze(placements || {}); }

  function mount(container, spec) {
    var x0 = 40, siteW = 21, rowH = 26, rowGap = 3, topY = 128;
    var W = x0 + C * siteW + 24, Hpx = topY + R * (rowH + rowGap) + 34, dpr = window.devicePixelRatio || 1;
    var placements = idealPlacements(), active = "C1", note = null, submitted = false, scoreObj = null;
    function sx(c) { return x0 + c * siteW; }
    function rowTop(r) { return topY + r * (rowH + rowGap); }
    function cellById(id) { for (var i = 0; i < CELLS.length; i++) if (CELLS[i].id === id) return CELLS[i]; return null; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "This is a packed die of standard-cell rows. The grey hatched cells are already placed. An ECO added <b>four</b> cells, and the placer dropped each at its ideal spot: they are on the die now, but every one lands on occupied sites, so <b>all four are illegal</b> (shown red). Legalize each: move it into a free gap, on the site grid, <b>no overlap</b>, as <b>close</b> to its dashed ideal as possible. The die is dense, so the nearest gap may be in an <b>adjacent row</b>; a row jump counts as extra displacement (" + ROWCOST + " per row). <b>Pick a cell</b> (chips), then <b>click a site</b> to move its left edge. Keep <b>total</b> displacement at or under budget (" + BUDGET + "), then <b>Submit placement</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit placement";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", USEDC = "#a8a29e";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* chips (4 across) */
      CELLS.forEach(function (c, i) {
        var cx = x0 + i * 112, cy = 54, w = 104, h = 36, isA = c.id === active, row = res.rows[i];
        ctx.fillStyle = isA ? "rgba(37,99,237,0.08)" : "#faf9f5"; ctx.strokeStyle = isA ? "#2563eb" : "#c9c6bd"; ctx.lineWidth = isA ? 2.2 : 1.2;
        ctx.fillRect(cx, cy, w, h); ctx.strokeRect(cx, cy, w, h);
        ctx.fillStyle = c.col; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(c.id + "  w" + c.w, cx + 8, cy + 11);
        var st = !row.ok ? "illegal" : "disp " + row.disp;
        ctx.fillStyle = row.ok ? OK : BAD; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillText(st, cx + 8, cy + 26);
        hits.push([cx, cy, cx + w, cy + h, "chip:" + c.id]);
      });
      /* die border */
      ctx.fillStyle = "#5a606e"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("die: " + R + " standard-cell rows x " + C + " sites", x0, topY - 6);
      ctx.strokeStyle = "#b8b4aa"; ctx.lineWidth = 1.4; ctx.strokeRect(x0 - 4, topY - 4, C * siteW + 8, R * (rowH + rowGap) - rowGap + 8);
      /* sites */
      for (var r = 0; r < R; r++) {
        var ry = rowTop(r);
        for (var c = 0; c < C; c++) {
          var x = sx(c), free = isFree(r, c);
          if (free) { ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e2dfd6"; ctx.lineWidth = 1; ctx.fillRect(x, ry, siteW, rowH); ctx.strokeRect(x, ry, siteW, rowH); }
          else {
            ctx.fillStyle = "#efece6"; ctx.strokeStyle = USEDC; ctx.lineWidth = 1; ctx.fillRect(x, ry, siteW, rowH); ctx.strokeRect(x, ry, siteW, rowH);
            ctx.save(); ctx.beginPath(); ctx.rect(x, ry, siteW, rowH); ctx.clip(); ctx.strokeStyle = "rgba(120,113,108,0.30)"; ctx.lineWidth = 1;
            for (var d = -rowH; d < siteW; d += 5) { ctx.beginPath(); ctx.moveTo(x + d, ry + rowH); ctx.lineTo(x + d + rowH, ry); ctx.stroke(); }
            ctx.restore();
          }
          hits.push([x, ry, x + siteW, ry + rowH, "site:" + r + "," + c]);
        }
      }
      /* ideal (origin) markers for every cell: dashed outline where it came from */
      CELLS.forEach(function (c) {
        var gy = rowTop(c.ir), isA = c.id === active;
        ctx.strokeStyle = c.col; ctx.globalAlpha = isA ? 0.9 : 0.4; ctx.lineWidth = isA ? 2 : 1.4; ctx.setLineDash([4, 3]);
        ctx.strokeRect(sx(c.il) + 1, gy + 1, c.w * siteW - 2, rowH - 2); ctx.setLineDash([]); ctx.globalAlpha = 1;
        if (isA) { ctx.fillStyle = c.col; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ideal", sx(c.il) + c.w * siteW / 2, gy + rowH / 2); }
      });
      /* placed ECO cells */
      res.rows.forEach(function (row) {
        if (!row.placed) return; var c = row.cell, x = sx(row.pos.left), y = rowTop(row.pos.row), w = c.w * siteW;
        ctx.fillStyle = row.ok ? c.col : "rgba(220,38,38,0.28)"; ctx.strokeStyle = row.ok ? c.col : BAD; ctx.lineWidth = 2;
        ctx.fillRect(x + 1, y + 1, w - 2, rowH - 2); ctx.strokeRect(x + 1, y + 1, w - 2, rowH - 2);
        ctx.fillStyle = row.ok ? "#fff" : BAD; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c.id, x + w / 2, y + rowH / 2);
      });
      ctx.fillStyle = MUT; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("click a site to move " + active + " (white = free gap, hatched = fixed cell, dashed = ideal)", x0, rowTop(R - 1) + rowH + 8);
    }
    function computeScore(res) { var total = Math.round(Math.max(6000, 10000 - (res.total - 9) * 1400)), best = total; try { var key = "mp-best-" + (spec.id || "eco-legal"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nBad = res.rows.filter(function (x) { return !x.ok; }).length;
      var head = res.pass ? "legal, minimal displacement" : (res.allOK ? "legal but moved too far" : nBad + " cell" + (nBad === 1 ? "" : "s") + " still illegal");
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + head + '</div>';
      if (note && !submitted) html += '<div class="mp-score"><span class="mp-score-note" style="color:#b45309">' + note + '</span></div>';
      res.rows.forEach(function (row) {
        var c = row.cell, det;
        if (!row.ok) det = row.reason === "fixed" ? "overlaps a fixed cell" : row.reason === "eco" ? "overlaps another new cell" : "off the die";
        else { var dr = Math.abs(row.pos.row - c.ir), dx = Math.abs(row.pos.left - c.il); det = "disp " + row.disp + " (" + dx + " site" + (dx === 1 ? "" : "s") + (dr ? " + " + dr + " row" + (dr === 1 ? "" : "s") : "") + ")"; }
        html += '<div class="mp-row ' + (row.ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (row.ok ? "✔" : "✗") + '</span><span class="mp-label">' + c.id + " (" + c.label + ')</span><span class="mp-detail" style="font-size:10px">' + det + '</span></div>';
      });
      html += '<div class="mp-row ' + (res.budgetOK ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.budgetOK ? "✔" : "✗") + '</span><span class="mp-label">Total displacement &le; budget</span><span class="mp-detail">' + (res.allOK ? res.total : "-") + " / " + BUDGET + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Every cell is legal and sits in the nearest gap to its ideal. Some rows had no close gap, so a hop to a neighbouring row was the smallest move: on a packed die that vertical decision is the heart of legalization.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>All four cells are legal and within budget.</b> Less displacement scores higher. Click <b>Submit placement</b>.</div>';
      else if (!res.allOK) html += '<div class="mp-score"><span class="mp-score-note">Cells still on occupied sites are illegal. Move each red cell into a white gap wide enough for it, no overlap with fixed cells or other new cells.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">All legal, but total displacement is too high (' + res.total + ' &gt; ' + BUDGET + '). For any cell with no near gap in its own row, use the closest gap in the row just above or below.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, placements); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) {
        var kind = h[4].split(":")[0], val = h[4].split(":")[1];
        if (kind === "chip") { active = val; note = null; }
        else { var parts = val.split(","); placements[active] = { row: parseInt(parts[0], 10), left: parseInt(parts[1], 10) }; note = null; }
        scoreObj = null; refresh(); break;
      } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { placements = idealPlacements(); active = "C1"; note = null; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.EcoLegal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
