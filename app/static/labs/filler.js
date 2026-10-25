/* Filler + tap-cell insertion lab. Each standard-cell row has gaps left by
   placement. Two post-placement jobs, done in the browser:
     - Filler: fill every gap so the follow-pin power rails and the wells stay
       continuous. Exposed sites break the rail (drawn as a gap in the rail).
     - Tap: drop well-tap cells so every site is within the tap reach (the
       latch-up / well-tie spacing rule), using as few taps as possible. Taps
       only fit in the gaps, never over a placed cell.
   Site model: occ[row][site] in {0 empty, 1 placed cell, 2 filler, 3 tap}.
   window.Filler = { evaluate, mount }. */
(function () {
  "use strict";
  function build(spec) {
    var occ = [];
    for (var r = 0; r < spec.rows; r++) occ.push(new Array(spec.sites).fill(0));
    (spec.cells || []).forEach(function (c) { for (var i = c.s0; i < c.s0 + c.len; i++) occ[c.row][i] = 1; });
    return occ;
  }
  function evaluate(spec, occ) {
    var exposed = 0, uncovered = 0, taps = 0;
    for (var r = 0; r < spec.rows; r++) {
      var tapSites = [];
      for (var i = 0; i < spec.sites; i++) { if (occ[r][i] === 0) exposed++; if (occ[r][i] === 3) { taps++; tapSites.push(i); } }
      for (var j = 0; j < spec.sites; j++) {
        var cov = tapSites.some(function (t) { return Math.abs(j - t) <= spec.reach; });
        if (!cov) uncovered++;
      }
    }
    var continuityOK = exposed === 0, coverageOK = uncovered === 0;
    return { exposed: exposed, uncovered: uncovered, taps: taps, continuityOK: continuityOK, coverageOK: coverageOK, pass: continuityOK && coverageOK };
  }

  function mount(container, spec) {
    var PAD = 22, sp = 520 / spec.sites, rowH = 24, gap = 16;
    var W = spec.sites * sp + PAD * 2, Hpx = spec.rows * (rowH + gap) + gap + PAD * 2 + 14;
    var occ = build(spec), tool = "filler", scoreObj = null;

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    /* tool selector */
    var tools = document.createElement("div"); tools.className = "mp-controls"; tools.style.margin = "8px 0";
    var bFiller = document.createElement("button"); bFiller.className = "btn mp-submit"; bFiller.textContent = "Filler tool";
    var bTap = document.createElement("button"); bTap.className = "btn btn-ghost"; bTap.textContent = "Tap tool";
    var bFill = document.createElement("button"); bFill.className = "btn btn-ghost"; bFill.textContent = "Fill all gaps";
    tools.appendChild(bFiller); tools.appendChild(bTap); tools.appendChild(bFill); left.appendChild(tools);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "6px 0";
    hint.innerHTML = "Filler tool: click a gap to fill it (or clear it). Tap tool: click a gap to place/remove a well tap. The green band under each row is the reach a tap covers.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit design";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function rowY(r) { return PAD + 8 + r * (rowH + gap); }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      for (var r = 0; r < spec.rows; r++) {
        var y = rowY(r);
        var tapSites = []; for (var k = 0; k < spec.sites; k++) if (occ[r][k] === 3) tapSites.push(k);
        for (var i = 0; i < spec.sites; i++) {
          var x = PAD + i * sp, st = occ[r][i];
          ctx.fillStyle = st === 1 ? "#c9c6bd" : st === 2 ? "rgba(37,99,237,0.16)" : st === 3 ? "rgba(217,119,6,0.85)" : "rgba(220,38,38,0.14)";
          ctx.fillRect(x, y, sp - 0.6, rowH);
          ctx.strokeStyle = "rgba(120,125,135,0.35)"; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, sp - 0.6, rowH);
          if (st === 3) { ctx.fillStyle = "#7c3a06"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("T", x + sp / 2, y + rowH / 2); ctx.textBaseline = "alphabetic"; }
        }
        /* follow-pin rails on the row edges, broken over exposed (empty) sites */
        [["#c23c32", y + 1], ["#2a5cc8", y + rowH - 1]].forEach(function (rr) {
          ctx.strokeStyle = rr[0]; ctx.lineWidth = 2.4;
          for (var s = 0; s < spec.sites; s++) { if (occ[r][s] !== 0) { ctx.beginPath(); ctx.moveTo(PAD + s * sp, rr[1]); ctx.lineTo(PAD + (s + 1) * sp - 0.6, rr[1]); ctx.stroke(); } }
        });
        /* coverage band under the row: green where within reach of a tap, red where not */
        for (var b = 0; b < spec.sites; b++) {
          var cov = tapSites.some(function (t) { return Math.abs(b - t) <= spec.reach; });
          ctx.fillStyle = cov ? "rgba(21,128,61,0.5)" : "rgba(220,38,38,0.55)";
          ctx.fillRect(PAD + b * sp, y + rowH + 2, sp - 0.6, 4);
        }
        ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText("row " + r, PAD - 3, y + rowH / 2);
      }
    }
    function computeScore(res) {
      var par = spec.tapPar || 10, eff = Math.max(0, Math.min(1, (par * 1.8 - res.taps) / (par * 0.8)));
      var total = Math.round(4000 + 6000 * eff), best = total;
      try { var key = "mp-best-" + (spec.id || "filler"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {}
      return { total: total, best: best };
    }
    function rowc(label, ok, detail) { return '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">' + label + '</span><span class="mp-detail">' + detail + '</span></div>'; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += rowc("Rows continuous (all gaps filled)", res.continuityOK, res.continuityOK ? "no exposed sites" : res.exposed + " exposed");
      html += rowc("Every site within tap reach", res.coverageOK, res.coverageOK ? "all covered" : res.uncovered + " uncovered");
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">taps used: <b>' + res.taps + '</b></span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div>' + (scoreObj.best > scoreObj.total ? '<div class="mp-score-line">your best: ' + scoreObj.best + '</div>' : '') + '<div class="mp-flow-note">Continuous and covered. Fewer taps score higher.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Continuous and fully covered.</b> Click <b>Submit design</b> to score it.</div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, occ); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function hit(e) {
      var r0 = canvas.getBoundingClientRect(), mxp = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, myp = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top;
      for (var r = 0; r < spec.rows; r++) { var y = rowY(r); if (myp >= y && myp <= y + rowH) { var i = Math.floor((mxp - PAD) / sp); if (i >= 0 && i < spec.sites) return [r, i]; } }
      return null;
    }
    function tap(e) {
      var h = hit(e); if (!h) return; var r = h[0], i = h[1], st = occ[r][i];
      if (st === 1) { e.preventDefault(); return; }         // placed cell, untouchable
      if (tool === "tap") { occ[r][i] = (st === 3) ? 0 : 3; }
      else { // filler tool: fill or clear the contiguous run
        if (st === 3) { occ[r][i] = 0; }
        else {
          var target = (st === 2) ? 0 : 2;                   // toggle fill/clear
          var a = i; while (a > 0 && (occ[r][a - 1] === st)) a--;
          var b = i; while (b < spec.sites - 1 && (occ[r][b + 1] === st)) b++;
          for (var k = a; k <= b; k++) occ[r][k] = target;
        }
      }
      scoreObj = null; refresh(); e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    function setTool(t) { tool = t; bFiller.className = "btn " + (t === "filler" ? "mp-submit" : "btn-ghost"); bTap.className = "btn " + (t === "tap" ? "mp-submit" : "btn-ghost"); }
    bFiller.addEventListener("click", function () { setTool("filler"); });
    bTap.addEventListener("click", function () { setTool("tap"); });
    bFill.addEventListener("click", function () { for (var r = 0; r < spec.rows; r++) for (var i = 0; i < spec.sites; i++) if (occ[r][i] === 0) occ[r][i] = 2; scoreObj = null; refresh(); });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(last); render(last); } });
    bReset.addEventListener("click", function () { occ = build(spec); scoreObj = null; setTool("filler"); refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.Filler = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
