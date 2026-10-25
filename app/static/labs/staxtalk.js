/* STA: crosstalk delta-delay. A victim net transitions inside a switching
   window. Coupled aggressors inject extra delay, but only the ones that (a)
   switch WITHIN the victim's window (temporal alignment) and (b) switch the
   OPPOSITE direction (Miller effect roughly doubles the coupling cap, slowing
   the victim) belong in the worst-case SETUP budget. An aggressor whose window
   cannot overlap the victim's transition injects nothing; a same-direction
   aggressor speeds the victim up and is left out of the setup budget. The
   per-aggressor delta scales with its coupling capacitance: delta = k x Cc.
   The learner clicks the aggressors that contribute; the budget is summed from
   their coupling caps. window.StaXtalk = { evaluate, mount }. */
(function () {
  "use strict";
  function overlap(w, v) { return w[0] < v[1] - 1e-9 && w[1] > v[0] + 1e-9; }
  function evaluate(spec, selected) {
    var creditDelta = 0, wrong = [], missing = [];
    spec.aggr.forEach(function (a) {
      var contrib = a.dir === "opp" && overlap(a.win, spec.victimWin);
      var sel = selected.indexOf(a.id) >= 0;
      if (contrib) { if (sel) creditDelta += spec.k * a.cc; else missing.push(a.id); }
      else if (sel) wrong.push(a.id);
    });
    var req = spec.T - spec.tsetup, slackNom = req - spec.arrival, slack = req - (spec.arrival + creditDelta);
    var fullDelta = spec.aggr.reduce(function (s, a) { return s + ((a.dir === "opp" && overlap(a.win, spec.victimWin)) ? spec.k * a.cc : 0); }, 0);
    var selectionCorrect = wrong.length === 0 && missing.length === 0;
    return { req: req, slackNom: slackNom, slack: slack, delta: creditDelta, fullDelta: fullDelta,
      wrong: wrong, missing: missing, selectionCorrect: selectionCorrect,
      met: slack >= -1e-9, pass: selectionCorrect && slack >= -1e-9 };
  }
  function mount(container, spec) {
    var W = 650, dpr = window.devicePixelRatio || 1;
    var rowH = 40, gap = 6, r0 = 56, nRows = spec.aggr.length + 1;
    var rowsBottom = r0 + nRows * (rowH + gap);
    var Hpx = rowsBottom + 96;
    var selected = [], scoreObj = null;
    var timeX0 = 292, timeX1 = W - 16, tSpan = spec.tMax - spec.tMin;
    function tx(t) { return timeX0 + (t - spec.tMin) / tSpan * (timeX1 - timeX0); }
    function contribOf(a) { return a.dir === "opp" && overlap(a.win, spec.victimWin); }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Click the aggressors that belong in the <b>worst-case setup</b> delta budget: those that switch <b>inside the victim window</b> (the green band) <b>and</b> in the <b>opposite</b> direction. Their coupling caps set the delta. Leave out non-overlapping and same-direction aggressors.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit sign-off";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    function rowY(i) { return r0 + i * (rowH + gap); }
    function capGlyph(x, y) {
      ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.lineTo(x + 5, y + 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x, y + 5); ctx.stroke();
    }
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx);
      /* time axis + ticks */
      ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(timeX0, 44); ctx.lineTo(timeX1, 44); ctx.stroke();
      ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      for (var t = Math.ceil(spec.tMin * 5) / 5; t <= spec.tMax + 1e-6; t += 0.2) { var X = tx(t); ctx.strokeStyle = "#e6e3da"; ctx.beginPath(); ctx.moveTo(X, 44); ctx.lineTo(X, rowsBottom); ctx.stroke(); ctx.fillStyle = "#8a90a0"; ctx.fillText(t.toFixed(1), X, 42); }
      ctx.fillStyle = "#5a606e"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("switching-window timeline (ns)", timeX0, 34);
      ctx.textAlign = "left"; ctx.fillStyle = "#5a606e"; ctx.fillText("net / coupling", 12, 34);
      /* victim window band across all rows */
      var bx0 = tx(spec.victimWin[0]), bx1 = tx(spec.victimWin[1]);
      ctx.fillStyle = "rgba(21,128,61,0.14)"; ctx.fillRect(bx0, 46, bx1 - bx0, rowsBottom - 46);
      ctx.strokeStyle = "rgba(21,128,61,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(bx0, 46, bx1 - bx0, rowsBottom - 46); ctx.setLineDash([]);

      /* victim row */
      var vy = rowY(0);
      ctx.fillStyle = "#eef1f7"; ctx.fillRect(12, vy, 268, rowH); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.strokeRect(12, vy, 268, rowH);
      ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("VICTIM  " + spec.victimNet, 20, vy + 14);
      ctx.fillStyle = "#15803d"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("transition window [" + spec.victimWin[0].toFixed(2) + ", " + spec.victimWin[1].toFixed(2) + "]", 20, vy + 29);
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(timeX0, vy + rowH / 2); ctx.lineTo(timeX1, vy + rowH / 2); ctx.stroke();
      ctx.fillStyle = "#15803d"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("victim switches", (bx0 + bx1) / 2, vy + rowH / 2 - 12);

      /* aggressor rows */
      spec.aggr.forEach(function (a, idx) {
        var y = rowY(idx + 1), sel = selected.indexOf(a.id) >= 0, contrib = contribOf(a), opp = a.dir === "opp";
        var frameCol = "#c9c6bd", frameW = 1;
        if (sel) { frameCol = contrib ? "#15803d" : "#dc2626"; frameW = 2.4; }
        /* left cell */
        ctx.fillStyle = sel ? (contrib ? "rgba(21,128,61,0.10)" : "rgba(220,38,38,0.10)") : "#faf9f5";
        ctx.fillRect(12, y, 268, rowH); ctx.strokeStyle = frameCol; ctx.lineWidth = frameW; ctx.strokeRect(12, y, 268, rowH);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(a.name, 20, y + 13);
        capGlyph(150, y + 13);
        ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillText("Cc " + a.cc + " fF", 162, y + 13);
        /* direction */
        ctx.fillStyle = opp ? "#dc2626" : "#15803d"; ctx.font = "700 9px 'JetBrains Mono', monospace";
        var dtxt = opp ? "opposite -> +delay" : "same -> speeds up";
        ctx.fillText(dtxt, 34, y + 29);
        /* small direction arrow */
        var ax = 24, ay = y + 29; ctx.strokeStyle = opp ? "#dc2626" : "#15803d"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax, ay - 5); ctx.lineTo(ax, ay + 5); ctx.stroke();
        ctx.beginPath(); if (opp) { ctx.moveTo(ax - 3, ay + 1); ctx.lineTo(ax, ay + 5); ctx.lineTo(ax + 3, ay + 1); } else { ctx.moveTo(ax - 3, ay - 1); ctx.lineTo(ax, ay - 5); ctx.lineTo(ax + 3, ay - 1); } ctx.stroke();
        ctx.fillStyle = "#6b7280"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.fillText("delta " + (spec.k * a.cc).toFixed(3), 274, y + 29);
        /* right cell: switching-window bar */
        var wx0 = tx(a.win[0]), wx1 = tx(a.win[1]);
        ctx.fillStyle = opp ? "rgba(220,38,38,0.40)" : "rgba(21,128,61,0.40)";
        ctx.fillRect(wx0, y + 10, wx1 - wx0, rowH - 20);
        ctx.strokeStyle = opp ? "#dc2626" : "#15803d"; ctx.lineWidth = 1.2; ctx.strokeRect(wx0, y + 10, wx1 - wx0, rowH - 20);
        /* overlap / exclusion tag */
        ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        var tag, tcol;
        if (!overlap(a.win, spec.victimWin)) { tag = "no overlap"; tcol = "#8a90a0"; }
        else if (!opp) { tag = "aligned, same dir"; tcol = "#15803d"; }
        else { tag = "aligned + opposite"; tcol = "#dc2626"; }
        ctx.fillStyle = tcol; ctx.fillText(tag, Math.min(wx1 + 6, timeX1 - 96), y + rowH / 2);
        if (sel) { ctx.fillStyle = contrib ? "#15803d" : "#dc2626"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.fillText(contrib ? "✔" : "✗", 274, y + 13); }
      });

      /* ---- delta math + slack bars ---- */
      var my0 = rowsBottom + 18;
      ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("worst-case delta-delay = sum of aligned opposite aggressors = +" + res.delta.toFixed(3) + " ns", 12, my0);
      var barX = 12, barW = W - 28, zero = barX + barW * 0.5, scl = 480;
      function bar(yy, label, v, faded) {
        ctx.fillStyle = "#eceae2"; ctx.fillRect(barX, yy, barW, 16); ctx.strokeStyle = "#c9c6bd"; ctx.lineWidth = 1; ctx.strokeRect(barX, yy, barW, 16);
        ctx.strokeStyle = "#9aa0aa"; ctx.beginPath(); ctx.moveTo(zero, yy - 3); ctx.lineTo(zero, yy + 19); ctx.stroke();
        var s = Math.max(-barW * 0.48, Math.min(barW * 0.48, v * scl));
        ctx.fillStyle = v >= 0 ? (faded ? "rgba(21,128,61,0.35)" : "rgba(21,128,61,0.6)") : "rgba(220,38,38,0.6)";
        ctx.fillRect(v >= 0 ? zero : zero + s, yy + 3, Math.abs(s), 10);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, barX + 4, yy - 8);
        ctx.textAlign = "right"; ctx.fillStyle = v >= 0 ? "#15803d" : "#dc2626"; ctx.fillText((v >= 0 ? "+" : "") + v.toFixed(3), barX + barW - 4, yy - 8);
      }
      bar(my0 + 22, "nominal slack (crosstalk ignored)", res.slackNom, true);
      bar(my0 + 54, "signed-off slack (with delta-delay)", res.slack, false);
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-xtalk"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var nContrib = spec.aggr.filter(contribOf).length;
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "PASS" : "not yet") + '</div>';
      html += '<div class="mp-row ' + (res.selectionCorrect ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.selectionCorrect ? "✔" : "✗") + '</span><span class="mp-label">Right aggressors budgeted</span><span class="mp-detail">' + (nContrib - res.missing.length) + " / " + nContrib + '</span></div>';
      html += '<div class="mp-row ' + (res.met ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.met ? "✔" : "✗") + '</span><span class="mp-label">Setup slack with delta &ge; 0</span><span class="mp-detail">' + (res.slack >= 0 ? "+" : "") + res.slack.toFixed(3) + '</span></div>';
      html += '<div class="mp-score"><span class="mp-score-note" style="font-size:11px">budgeted delta +' + res.delta.toFixed(3) + ' ns &middot; ignoring crosstalk the slack looks like +' + res.slackNom.toFixed(2) + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Only the aligned, opposite-switching aggressors go in the budget. The nominal ' + res.slackNom.toFixed(2) + ' hid a chip that really has just ' + res.slack.toFixed(3) + ' ns of margin.</div></div>';
      else if (res.pass) html += '<div class="mp-flow mp-flow-ready"><b>Correct worst-case budget, slack still positive.</b> Click <b>Submit sign-off</b>.</div>';
      else if (res.wrong.length) html += '<div class="mp-score"><span class="mp-score-note">A red aggressor does not belong in the setup budget: it either does not overlap the victim window (cannot couple during the transition) or switches the same direction (it speeds the victim up, easing setup). Unclick it.</span></div>';
      else if (res.missing.length) html += '<div class="mp-score"><span class="mp-score-note">An aligned, opposite-switching aggressor is still missing from the budget. Under-counting hides real delay and ships a failing chip. Add every red-tagged (aligned + opposite) aggressor.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">' + (spec.hint || "") + '</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, selected); draw(last); render(last); bSubmit.disabled = !last.pass; bSubmit.classList.toggle("mp-ready", last.pass); }
    function tap(e) {
      var r0b = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0b.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0b.top;
      spec.aggr.forEach(function (a, idx) { var y = rowY(idx + 1); if (px >= 12 && px <= timeX1 && py >= y && py <= y + rowH) { var j = selected.indexOf(a.id); if (j >= 0) selected.splice(j, 1); else selected.push(a.id); scoreObj = null; refresh(); } });
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (last && last.pass) { scoreObj = computeScore(); render(last); } });
    bReset.addEventListener("click", function () { selected = []; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaXtalk = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
