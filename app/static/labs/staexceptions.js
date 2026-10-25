/* STA: timing exceptions (triage). Each reported path is one of: fine as
   single-cycle, a genuine multicycle path (read the note for how many clocks),
   a false path (synchronizer / scan / async / quasi-static), or a REAL violation
   that must go back for a fix. Classify each correctly - and never false-path a
   real functional violation, which only hides a bug.
   window.StaExceptions = { evaluate, mount }. */
(function () {
  "use strict";
  function slackFor(spec, p, opt) { if (opt === 4) return null; var cyc = spec.optionCycles[opt]; return cyc * spec.period - spec.tsetup - p.delay; }
  function evaluate(spec, choice) {
    var allCorrect = true; spec.paths.forEach(function (p, i) { if (choice[i] !== p.correct) allCorrect = false; });
    return { allCorrect: allCorrect, pass: allCorrect };
  }
  function mount(container, spec) {
    var PAD = 14, W = 620, rowH = 54, gap = 6;
    var Hpx = PAD * 2 + spec.paths.length * (rowH + gap);
    var choice = spec.paths.map(function () { return 0; }), submitted = false, scoreObj = null;
    var COL = ["#64748b", "#2563eb", "#1d4ed8", "#1e3a8a", "#7c3aed", "#dc2626"];

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas"); var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "Click a path to cycle its classification: single-cycle / multicycle-2/3/4 / false path / REAL violation. Read the note to decide. Submit when every path is triaged.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit triage";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var rows = [];
    function rowY(i) { return PAD + i * (rowH + gap); }
    function draw() {
      ctx.clearRect(0, 0, W, Hpx); rows = [];
      spec.paths.forEach(function (p, i) {
        var y = rowY(i), opt = choice[i], s = slackFor(spec, p, opt), right = submitted && choice[i] === p.correct, wrong = submitted && choice[i] !== p.correct;
        ctx.fillStyle = "#f6f5f0"; ctx.fillRect(PAD, y, W - 2 * PAD, rowH);
        ctx.strokeStyle = wrong ? "#dc2626" : (right ? "#15803d" : "#c9c6bd"); ctx.lineWidth = (wrong || right) ? 2 : 1; ctx.strokeRect(PAD, y, W - 2 * PAD, rowH);
        ctx.fillStyle = "#1a1d26"; ctx.font = "bold 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(p.id, PAD + 8, y + 7);
        ctx.fillStyle = "#8a90a0"; ctx.font = "8px 'JetBrains Mono', monospace"; ctx.fillText("path delay " + p.delay.toFixed(2) + " ns", PAD + 8, y + 22);
        ctx.fillStyle = "#5a606e"; ctx.font = "9px 'JetBrains Mono', monospace"; ctx.fillText(p.note, PAD + 8, y + 36);
        /* classification badge */
        var bx = W - PAD - 132, col = COL[opt];
        ctx.fillStyle = col; ctx.fillRect(bx, y + 8, 124, rowH - 16);
        ctx.fillStyle = "#fff"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(spec.options[opt], bx + 62, y + rowH / 2 - 6);
        ctx.font = "8px 'JetBrains Mono', monospace";
        var status = opt === 4 ? "excluded" : opt === 5 ? "send to ECO" : ((s >= 0 ? "slack +" : "slack ") + s.toFixed(2));
        ctx.fillStyle = (opt === 4 || opt === 5) ? "#f1f5f9" : (s >= 0 ? "#dcfce7" : "#fecaca");
        ctx.fillText(status, bx + 62, y + rowH / 2 + 8);
        rows.push([PAD, y, W - PAD, y + rowH, i]);
      });
    }
    function computeScore() { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "sta-exceptions"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html;
      if (!submitted) html = '<div class="mp-verdict" style="background:#eceae2;color:#5a606e">triage each path</div><div class="mp-score"><span class="mp-score-note">' + spec.hint + '</span></div>';
      else {
        var ok = res.pass, nwrong = spec.paths.filter(function (p, i) { return choice[i] !== p.correct; }).length;
        html = '<div class="mp-verdict ' + (ok ? "mp-pass" : "mp-fail") + '">' + (ok ? "PASS" : nwrong + " wrong") + '</div>';
        html += '<div class="mp-row ' + (ok ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (ok ? "✔" : "✗") + '</span><span class="mp-label">Every path triaged correctly</span><span class="mp-detail">' + (spec.paths.length - nwrong) + " / " + spec.paths.length + '</span></div>';
        if (ok && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Real violations flagged, multicycle and false paths excepted correctly - no bugs hidden.</div></div>';
        else if (!ok) html += '<div class="mp-score"><span class="mp-score-note">Red rows are misclassified. Re-read their notes: a synchronizer/scan/async crossing is a false path, a slow-but-functional single-cycle path is a REAL violation (fix it, do not except it), and a multicycle path needs the exact cycle count from its note.</span></div>';
      }
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, choice); draw(); render(last); bSubmit.disabled = submitted; bSubmit.classList.toggle("mp-ready", !submitted); }
    function tap(e) { if (submitted) return; var r0 = canvas.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r0.left, py = (e.touches ? e.touches[0].clientY : e.clientY) - r0.top; for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]) { choice[r[4]] = (choice[r[4]] + 1) % spec.options.length; refresh(); break; } } e.preventDefault(); }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted) { submitted = true; if (evaluate(spec, choice).pass) scoreObj = computeScore(); refresh(); } });
    bReset.addEventListener("click", function () { choice = spec.paths.map(function () { return 0; }); submitted = false; scoreObj = null; refresh(); });
    refresh();
  }
  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.StaExceptions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
