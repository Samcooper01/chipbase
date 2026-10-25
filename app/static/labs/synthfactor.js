/* Synthesis lab: synth-factor (common-subexpression extraction).
   Several product terms of a design are shown as a term-by-literal matrix. A common
   subexpression is a rectangle: a set of terms that all share a set of literals.
   Extracting that rectangle builds the shared factor once and reuses it, so the
   literals inside it are computed a single time instead of once per term. The value
   of a rectangle of R terms and L literals is R*L - R - L: the R*L literals it
   removes, minus the L literals to build the factor once and the R wires that
   replace it. The learner selects the rectangle with the greatest value. Best here:
   terms T1,T2,T3 share a,b, so extract t = a*b. window.SynthFactor = { evaluate, mount }. */
(function () {
  "use strict";
  var TERMS = [
    { id: "T1", lits: ["a", "b", "c"] }, { id: "T2", lits: ["a", "b", "d"] },
    { id: "T3", lits: ["a", "b", "e"] }, { id: "T4", lits: ["a", "c", "f"] }
  ];
  var LITS = ["a", "b", "c", "d", "e", "f"];
  var MAXSAVE = 1;
  function has(tid, l) { for (var i = 0; i < TERMS.length; i++) if (TERMS[i].id === tid) return TERMS[i].lits.indexOf(l) >= 0; return false; }
  function analyze(rows, cols) {
    if (rows.length === 0 || cols.length === 0) return { valid: false, empty: true, saving: null, rows: rows, cols: cols, pass: false };
    var valid = rows.every(function (t) { return cols.every(function (l) { return has(t, l); }); });
    var saving = valid ? rows.length * cols.length - rows.length - cols.length : null;
    return { valid: valid, empty: false, saving: saving, rows: rows, cols: cols, pass: valid && saving === MAXSAVE };
  }
  function evaluate(spec, sel) { sel = sel || {}; return analyze(sel.rows || [], sel.cols || []); }

  function mount(container, spec) {
    var W = 560, Hpx = 320, dpr = window.devicePixelRatio || 1;
    var rows = [], cols = [], submitted = false, scoreObj = null;
    var mx = 130, my = 96, cw = 52, ch = 34;
    function colX(j) { return mx + j * cw; }
    function rowY(i) { return my + i * ch; }

    var wrap = document.createElement("div"); wrap.className = "mp-wrap";
    var left = document.createElement("div"); left.className = "mp-left";
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr; canvas.height = Hpx * dpr; canvas.style.width = W + "px"; canvas.style.height = Hpx + "px";
    canvas.className = "mp-canvas"; canvas.style.cursor = "pointer"; var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left.appendChild(canvas);
    var hint = document.createElement("div"); hint.className = "mp-legend-title"; hint.style.display = "block"; hint.style.margin = "8px 0"; hint.style.maxWidth = W + "px";
    hint.innerHTML = "The rows are product terms of the design; a dot means the term contains that literal. A <b>common subexpression</b> is a rectangle: a set of terms that all share a set of literals. Extract it once and every term reuses it. The <b>value</b> of a rectangle of R terms and L literals is R×L − R − L (the shared literals removed, minus the cost of building the factor once and wiring it back). <b>Click term rows and literal columns</b> to select a rectangle; every selected cell must be filled. Find the rectangle with the greatest value, then <b>Submit factor</b>.";
    left.appendChild(hint);
    var ctrls = document.createElement("div"); ctrls.className = "mp-controls";
    var bSubmit = document.createElement("button"); bSubmit.className = "btn mp-submit"; bSubmit.textContent = "Submit factor";
    var bReset = document.createElement("button"); bReset.className = "btn btn-ghost"; bReset.textContent = "Reset";
    ctrls.appendChild(bSubmit); ctrls.appendChild(bReset); left.appendChild(ctrls); wrap.appendChild(left);
    var panel = document.createElement("div"); panel.className = "mp-panel"; wrap.appendChild(panel);
    container.appendChild(wrap);

    var OK = "#15803d", BAD = "#dc2626", MUT = "#6b7280", SEL = "#2563eb";
    var hits = [];
    function draw(res) {
      ctx.clearRect(0, 0, W, Hpx); hits = [];
      /* column headers (literals) */
      LITS.forEach(function (l, j) {
        var x = colX(j), on = cols.indexOf(l) >= 0;
        ctx.fillStyle = on ? "rgba(37,99,237,0.14)" : "#faf9f5"; ctx.strokeStyle = on ? SEL : "#c9c6bd"; ctx.lineWidth = on ? 2 : 1; ctx.fillRect(x, my - 30, cw - 4, 24); ctx.strokeRect(x, my - 30, cw - 4, 24);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l, x + (cw - 4) / 2, my - 18);
        hits.push([x, my - 30, x + cw - 4, my - 6, "col:" + l]);
      });
      /* row headers (terms) + cells */
      TERMS.forEach(function (t, i) {
        var y = rowY(i), onR = rows.indexOf(t.id) >= 0;
        ctx.fillStyle = onR ? "rgba(37,99,237,0.14)" : "#faf9f5"; ctx.strokeStyle = onR ? SEL : "#c9c6bd"; ctx.lineWidth = onR ? 2 : 1; ctx.fillRect(6, y, mx - 12, ch - 4); ctx.strokeRect(6, y, mx - 12, ch - 4);
        ctx.fillStyle = "#1a1d26"; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(t.id + ": " + t.lits.join("·"), 12, y + (ch - 4) / 2);
        hits.push([6, y, mx - 6, y + ch - 4, "row:" + t.id]);
        LITS.forEach(function (l, j) {
          var x = colX(j), inTerm = t.lits.indexOf(l) >= 0, inRect = onR && cols.indexOf(l) >= 0;
          if (inRect) { ctx.fillStyle = inTerm ? "rgba(21,128,61,0.20)" : "rgba(220,38,38,0.20)"; ctx.fillRect(x, y, cw - 4, ch - 4); }
          ctx.strokeStyle = "#ece9e0"; ctx.lineWidth = 1; ctx.strokeRect(x, y, cw - 4, ch - 4);
          if (inTerm) { ctx.fillStyle = inRect ? OK : "#334155"; ctx.beginPath(); ctx.arc(x + (cw - 4) / 2, y + (ch - 4) / 2, 5, 0, Math.PI * 2); ctx.fill(); }
          else if (inRect) { ctx.fillStyle = BAD; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("×", x + (cw - 4) / 2, y + (ch - 4) / 2); }
        });
      });
      /* saving readout */
      ctx.fillStyle = MUT; ctx.font = "700 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      var msg = res.empty ? "select rows and columns" : (!res.valid ? "not a rectangle (a selected cell is empty)" : "R=" + res.rows.length + " L=" + res.cols.length + "  value = " + res.saving);
      ctx.fillStyle = res.valid ? (res.saving > 0 ? OK : MUT) : BAD; ctx.fillText(msg, 12, rowY(TERMS.length) + 6);
    }
    function computeScore(res) { var total = 10000, best = total; try { var key = "mp-best-" + (spec.id || "synth-factor"); var prev = parseInt(window.localStorage.getItem(key) || "0", 10); best = Math.max(prev, total); window.localStorage.setItem(key, String(best)); } catch (e) {} return { total: total, best: best }; }
    function render(res) {
      var html = '<div class="mp-verdict ' + (res.pass ? "mp-pass" : "mp-fail") + '">' + (res.pass ? "best factor found" : (res.valid ? (res.empty ? "nothing selected" : "valid, but not the best") : "not a rectangle")) + '</div>';
      html += '<div class="mp-row ' + (res.valid && !res.empty ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.valid && !res.empty ? "✔" : "✗") + '</span><span class="mp-label">Selection is a rectangle</span><span class="mp-detail">' + (res.empty ? "-" : res.valid ? "yes" : "no") + '</span></div>';
      html += '<div class="mp-row ' + (res.pass ? "mp-ok" : "mp-bad") + '"><span class="mp-mark">' + (res.pass ? "✔" : "✗") + '</span><span class="mp-label">Value = maximum</span><span class="mp-detail">' + (res.saving == null ? "-" : res.saving) + " / " + MAXSAVE + '</span></div>';
      if (res.pass && scoreObj) html += '<div class="mp-flow mp-flow-done"><div class="mp-score-big">score <b>' + scoreObj.total + '</b> / 10000</div><div class="mp-flow-note">Extract t = a·b once: then T1 = t·c, T2 = t·d, T3 = t·e. The product a·b is built a single time instead of three, which is the biggest saving available here.</div></div>';
      else if (res.valid && !res.empty && res.saving > 0) html += '<div class="mp-flow mp-flow-ready"><b>A worthwhile factor (value ' + res.saving + '), but not the biggest.</b> A rectangle covering more terms with the shared literals is worth more. Keep looking, or submit.</div>';
      else if (!res.valid && !res.empty) html += '<div class="mp-score"><span class="mp-score-note">A selected term does not contain a selected literal (red ×). A rectangle needs every selected term to share every selected literal.</span></div>';
      else html += '<div class="mp-score"><span class="mp-score-note">Pick the largest group of terms that all share the same literals. More terms sharing more literals means a larger value R×L − R − L.</span></div>';
      panel.innerHTML = html;
    }
    var last = null;
    function refresh() { last = evaluate(spec, { rows: rows, cols: cols }); draw(last); render(last); bSubmit.disabled = submitted || !last.pass; bSubmit.classList.toggle("mp-ready", !submitted && last.pass); }
    function tap(e) {
      if (submitted) return; var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, px = t.clientX - r.left, py = t.clientY - r.top;
      for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (px >= h[0] && px <= h[2] && py >= h[1] && py <= h[3]) {
        var kind = h[4].split(":")[0], id = h[4].split(":")[1], arr = kind === "row" ? rows : cols, k = arr.indexOf(id);
        if (k >= 0) arr.splice(k, 1); else arr.push(id); scoreObj = null; refresh(); break;
      } }
      e.preventDefault();
    }
    canvas.addEventListener("mousedown", tap); canvas.addEventListener("touchstart", tap, { passive: false });
    bSubmit.addEventListener("click", function () { if (!submitted && last && last.pass) { submitted = true; scoreObj = computeScore(last); refresh(); } });
    bReset.addEventListener("click", function () { rows = []; cols = []; submitted = false; scoreObj = null; refresh(); });
    refresh();
  }

  var api = { evaluate: evaluate, mount: mount };
  if (typeof window !== "undefined") window.SynthFactor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
